'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Search, Trash2, Inbox } from 'lucide-react';
import { api } from './api';
import { Confirm, Pager, Stars, Switch, useToast } from './ui';
import { mediaSrc } from '@/lib/format';
import { formatMoney, labelOf, priceSpread, RESOURCES, type Column, type Resource } from '@/lib/resources';
import { useRole } from './AdminShell';

type Row = Record<string, any>;
type ListResult = { items: Row[]; total: number; page: number; pageSize: number };

const BADGE_TONE: Record<string, string> = {
  for_sale: 'ok', for_rent: 'info', sold: 'red', leased: '', upcoming: 'info', selling: 'ok', sold_out: 'red',
};

/** The public display price, exactly as the website shows it. */
function money(row: Row, field: string) {
  const text = row.price_label || row.starting_price || (row[field] != null ? formatMoney(row[field], row.currency || 'INR') : '');
  return text || <span className="muted">—</span>;
}

/** Internal pricing (admins only): builder / brokerage and the difference. */
function pricing(row: Row) {
  const cur = row.currency || 'INR';
  const sp = priceSpread(row.builder_price, row.brokerage_price);
  if (row.builder_price == null && row.brokerage_price == null) return <span className="muted">—</span>;
  return (
    <div style={{ lineHeight: 1.35 }}>
      <div>{formatMoney(row.builder_price, cur) || '—'} <span className="muted">/</span> {formatMoney(row.brokerage_price, cur) || '—'}</div>
      {sp && <div className="sub" style={{ color: sp.diff >= 0 ? 'var(--ok)' : 'var(--accent)' }}>
        Δ {formatMoney(sp.diff, cur)}{sp.pct != null ? ` · ${sp.pct.toFixed(1)}%` : ''}</div>}
    </div>
  );
}

function Cell({ r, c, row }: { r: Resource; c: Column; row: Row }) {
  const v = row[c.field];
  switch (c.kind) {
    case 'image': {
      const round = r.key === 'agents' || r.key === 'reviews';
      return v
        // eslint-disable-next-line @next/next/no-img-element
        ? <img className={`thumb ${round ? 'round' : ''}`} src={mediaSrc(v)} alt="" loading="lazy" />
        : <span className={`thumb ${round ? 'round' : ''}`} />;
    }
    case 'title': return <Link href={`/admin/${r.key}/${row.id}`}>{v || <em className="muted">Untitled</em>}</Link>;
    case 'money': return <>{money(row, c.field)}</>;
    case 'pricing': return pricing(row);
    case 'badge': {
      const f = r.fields.find((x) => x.name === c.field);
      return <span className={`badge ${BADGE_TONE[v] ?? ''}`}>{labelOf(f?.options, v)}</span>;
    }
    case 'rating': return <Stars value={Number(v) || 0} />;
    case 'date': return <>{v ? new Date(v + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : <span className="muted">—</span>}</>;
    default: return <>{v || <span className="muted">—</span>}</>;
  }
}

export default function ResourceList({ resourceKey }: { resourceKey: string }) {
  const base = RESOURCES[resourceKey];
  const role = useRole();
  const r = role === 'admin' ? base : { ...base, columns: base.columns.filter((c) => !c.confidential) };
  const toast = useToast();
  const router = useRouter();
  const sp = useSearchParams();
  const [data, setData] = useState<ListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qText, setQText] = useState(sp.get('q') || '');
  const [del, setDel] = useState<Row | null>(null);
  const [busyDel, setBusyDel] = useState(false);
  const hasOrder = r.fields.some((f) => f.name === 'display_order');

  const params = new URLSearchParams(sp.toString());
  const page = Number(params.get('page')) || 1;
  const query = sp.toString();

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await api<ListResult>(`/api/admin/r/${r.key}?${query}`)); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [r.key, query]);
  useEffect(() => { load(); }, [load]);

  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(sp.toString());
    if (v) p.set(k, v); else p.delete(k);
    if (k !== 'page') p.delete('page');
    router.replace(`/admin/${r.key}${p.toString() ? `?${p}` : ''}`, { scroll: false });
  };

  // Debounced search box.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => setParam('q', qText.trim()), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qText]);

  async function patch(row: Row, body: Row, msg: string) {
    setData((d) => d && { ...d, items: d.items.map((x) => (x.id === row.id ? { ...x, ...body } : x)) });
    try { await api(`/api/admin/r/${r.key}/${row.id}`, { method: 'PATCH', body }); toast(msg); }
    catch (e) { toast((e as Error).message, 'err'); load(); }
  }

  async function move(i: number, dir: -1 | 1) {
    if (!data) return;
    const a = data.items[i], b = data.items[i + dir];
    if (!a || !b) return;
    // Swap positions; if both share an order value, space them apart first.
    let ao = a.display_order ?? 0, bo = b.display_order ?? 0;
    if (ao === bo) { ao = bo + (dir === 1 ? 1 : -1); }
    try {
      await api(`/api/admin/r/${r.key}/${a.id}`, { method: 'PATCH', body: { display_order: bo } });
      await api(`/api/admin/r/${r.key}/${b.id}`, { method: 'PATCH', body: { display_order: ao } });
      toast('Order updated');
    } catch (e) { toast((e as Error).message, 'err'); }
    load();
  }

  async function confirmDelete() {
    if (!del) return;
    setBusyDel(true);
    try {
      await api(`/api/admin/r/${r.key}/${del.id}`, { method: 'DELETE' });
      toast(`${r.singular} deleted`);
      setDel(null);
      load();
    } catch (e) { toast((e as Error).message, 'err'); }
    finally { setBusyDel(false); }
  }

  return (
    <>
      <div className="page-head">
        <div><h1>{r.label}</h1><p>{r.description}</p></div>
        <div className="actions"><Link className="btn btn-primary" href={`/admin/${r.key}/new`}><Plus size={16} />Add {r.singular.toLowerCase()}</Link></div>
      </div>

      <section className="card">
        <div className="toolbar">
          <div className="search"><Search size={16} />
            <input className="input" placeholder={`Search ${r.label.toLowerCase()}…`} value={qText} onChange={(e) => setQText(e.target.value)} aria-label="Search" />
          </div>
          {r.filters.map((f) => (
            <select key={f.name} className="select" style={{ width: 'auto', minWidth: 150 }} value={sp.get(f.name) || ''} onChange={(e) => setParam(f.name, e.target.value)} aria-label={f.label}>
              <option value="">All {f.label.toLowerCase()}</option>
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ))}
        </div>

        {error && <div className="card-body"><div className="alert err">{error}</div></div>}
        <div className="table-wrap">
          <table className="tbl stack">
            <thead><tr>
              {r.columns.map((c) => <th key={c.field}>{c.label}</th>)}
              {r.toggles.map((t) => <th key={t.field}>{t.label}</th>)}
              <th className="num">Actions</th>
            </tr></thead>
            <tbody>
              {loading && !data && [0, 1, 2, 3, 4].map((i) => (
                <tr key={i}>{[...r.columns, ...r.toggles, 0].map((_, j) => <td key={j}><div className="skeleton" style={{ width: j === 1 ? 180 : 70 }} /></td>)}</tr>
              ))}
              {data?.items.map((row, i) => (
                <tr key={row.id} style={{ opacity: loading ? 0.6 : 1 }}>
                  {r.columns.map((c) => (
                    <td key={c.field} data-label={c.label} className={c.kind === 'image' ? 'c-img' : c.kind === 'title' ? 'title-cell' : ''}>
                      <Cell r={r} c={c} row={row} />
                    </td>
                  ))}
                  {r.toggles.map((t) => (
                    <td key={t.field} data-label={t.label}>
                      <Switch checked={!!row[t.field]} label={row[t.field] ? t.on : t.off}
                        onChange={(v) => patch(row, { [t.field]: v }, `${t.label}: ${v ? t.on : t.off}`)} />
                    </td>
                  ))}
                  <td className="c-actions">
                    <div className="row-actions">
                      {hasOrder && !sp.get('q') && (<>
                        <button className="icon-btn" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={16} /></button>
                        <button className="icon-btn" title="Move down" disabled={i === data.items.length - 1} onClick={() => move(i, 1)}><ArrowDown size={16} /></button>
                      </>)}
                      <Link className="icon-btn" title="Edit" href={`/admin/${r.key}/${row.id}`}><Pencil size={16} /></Link>
                      <button className="icon-btn" title="Delete" onClick={() => setDel(row)}><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && !data.items.length && (
          <div className="empty"><Inbox size={32} />
            <div>{sp.toString() ? 'Nothing matches these filters.' : `No ${r.label.toLowerCase()} yet.`}</div>
            {!sp.toString() && <Link className="btn btn-primary btn-sm" style={{ marginTop: 12 }} href={`/admin/${r.key}/new`}><Plus size={14} />Add the first one</Link>}
          </div>
        )}
        {data && data.total > 0 && <Pager page={page} pageSize={data.pageSize} total={data.total} onPage={(p) => setParam('page', String(p))} />}
      </section>

      <Confirm open={!!del} busy={busyDel} title={`Delete this ${r.singular.toLowerCase()}?`}
        body={<>“{del?.[r.titleField]}” will be removed from the website and the admin. This can’t be undone.</>}
        onConfirm={confirmDelete} onCancel={() => setDel(null)} />
    </>
  );
}
