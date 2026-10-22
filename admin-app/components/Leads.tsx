'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Download, ExternalLink, Inbox, Mail, MessageSquare, Phone, Search, StickyNote, Trash2 } from 'lucide-react';
import { api } from './api';
import { TimeAgo } from './TimeAgo';
import { Confirm, fmtDate, Pager, useToast } from './ui';
import { LEAD_STATUS, labelOf } from '@/lib/resources';

type Row = Record<string, any>;
const TONE: Record<string, string> = { new: 'red', contacted: 'info', follow_up: 'warn', qualified: 'ok', closed: 'ok', lost: '' };
const waLink = (phone: string) => `https://wa.me/${phone.replace(/\D/g, '')}`;

export function LeadsList() {
  const router = useRouter();
  const sp = useSearchParams();
  const toast = useToast();
  const [data, setData] = useState<{ items: Row[]; total: number; pageSize: number; facets: { types: string[]; sources: string[] } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qText, setQText] = useState(sp.get('q') || '');
  const query = sp.toString();
  const page = Number(sp.get('page')) || 1;

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await api(`/api/admin/leads?${query}`)); } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [query]);
  useEffect(() => { load(); }, [load]);

  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(sp.toString());
    if (v) p.set(k, v); else p.delete(k);
    if (k !== 'page') p.delete('page');
    router.replace(`/admin/leads${p.toString() ? `?${p}` : ''}`, { scroll: false });
  };
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => setParam('q', qText.trim()), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qText]);

  async function setStatus(row: Row, status: string) {
    setData((d) => d && { ...d, items: d.items.map((x) => (x.id === row.id ? { ...x, status } : x)) });
    try { await api(`/api/admin/leads/${row.id}`, { method: 'PATCH', body: { status } }); toast(`Marked as ${labelOf(LEAD_STATUS, status)}`); router.refresh(); }
    catch (e) { toast((e as Error).message, 'err'); load(); }
  }

  const exportQuery = new URLSearchParams(sp.toString());
  exportQuery.delete('page');

  return (
    <>
      <div className="page-head">
        <div><h1>Leads / Enquiries</h1><p>Every enquiry submitted through the website’s forms.</p></div>
        <div className="actions"><a className="btn" href={`/api/admin/leads/export?${exportQuery}`}><Download size={16} />Export CSV</a></div>
      </div>

      <div className="status-pills" style={{ marginBottom: 14 }}>
        <button className={!sp.get('status') ? 'on' : ''} onClick={() => setParam('status', '')}>All</button>
        {LEAD_STATUS.map((s) => <button key={s.value} className={sp.get('status') === s.value ? 'on' : ''} onClick={() => setParam('status', s.value)}>{s.label}</button>)}
      </div>

      <section className="card">
        <div className="toolbar">
          <div className="search"><Search size={16} />
            <input className="input" placeholder="Search name, email, phone, message…" value={qText} onChange={(e) => setQText(e.target.value)} aria-label="Search leads" />
          </div>
          <select className="select" style={{ width: 'auto', minWidth: 160 }} value={sp.get('type') || ''} onChange={(e) => setParam('type', e.target.value)} aria-label="Inquiry type">
            <option value="">All inquiry types</option>
            {data?.facets.types.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select className="select" style={{ width: 'auto', minWidth: 150 }} value={sp.get('source') || ''} onChange={(e) => setParam('source', e.target.value)} aria-label="Source">
            <option value="">All sources</option>
            {data?.facets.sources.map((t) => <option key={t}>{t}</option>)}
          </select>
          <input className="input" type="date" style={{ width: 'auto' }} value={sp.get('from') || ''} onChange={(e) => setParam('from', e.target.value)} aria-label="From date" />
          <input className="input" type="date" style={{ width: 'auto' }} value={sp.get('to') || ''} onChange={(e) => setParam('to', e.target.value)} aria-label="To date" />
        </div>
        {error && <div className="card-body"><div className="alert err">{error}</div></div>}
        <div className="table-wrap">
          <table className="tbl stack">
            <thead><tr><th>Name</th><th>Contact</th><th>Inquiry</th><th>Source</th><th>Received</th><th>Status</th></tr></thead>
            <tbody>
              {data?.items.map((l) => (
                <tr key={l.id} style={{ opacity: loading ? 0.6 : 1 }}>
                  <td className="title-cell" data-label="Name">
                    <Link href={`/admin/leads/${l.id}`}>{l.name}</Link>
                    {l.message && <div className="sub" style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.message}</div>}
                  </td>
                  <td data-label="Contact"><div>{l.phone || '—'}</div><div className="sub">{l.email}</div></td>
                  <td data-label="Inquiry">{l.inquiry_type || '—'}{l.reference_label && <div className="sub">{l.reference_label}</div>}</td>
                  <td data-label="Source">{l.source || '—'}</td>
                  <td data-label="Received"><TimeAgo iso={l.created_at} /></td>
                  <td data-label="Status">
                    <select className="select" style={{ height: 32, minWidth: 130 }} value={l.status} onChange={(e) => setStatus(l, e.target.value)} aria-label={`Status for ${l.name}`}>
                      {LEAD_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
              {loading && !data && [0, 1, 2, 3].map((i) => <tr key={i}>{[0, 1, 2, 3, 4, 5].map((j) => <td key={j}><div className="skeleton" style={{ width: 90 }} /></td>)}</tr>)}
            </tbody>
          </table>
        </div>
        {data && !data.items.length && <div className="empty"><Inbox size={32} /><div>{query ? 'No leads match these filters.' : 'No enquiries yet. Submissions from the website’s forms will appear here.'}</div></div>}
        {data && data.total > 0 && <Pager page={page} pageSize={data.pageSize} total={data.total} onPage={(p) => setParam('page', String(p))} />}
      </section>
    </>
  );
}

export function LeadView({ id, canDelete }: { id: number; canDelete: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [lead, setLead] = useState<Row | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [askDel, setAskDel] = useState(false);

  useEffect(() => { api(`/api/admin/leads/${id}`).then(setLead).catch((e) => setError(e.message)); }, [id]);

  async function setStatus(status: string) {
    try { setLead(await api(`/api/admin/leads/${id}`, { method: 'PATCH', body: { status } })); toast(`Marked as ${labelOf(LEAD_STATUS, status)}`); router.refresh(); }
    catch (e) { toast((e as Error).message, 'err'); }
  }
  async function addNote(e: FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setBusy(true);
    try { setLead(await api(`/api/admin/leads/${id}/notes`, { body: { note } })); setNote(''); toast('Note added'); }
    catch (err) { toast((err as Error).message, 'err'); } finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true);
    try { await api(`/api/admin/leads/${id}`, { method: 'DELETE' }); toast('Lead deleted'); router.replace('/admin/leads'); router.refresh(); }
    catch (e) { toast((e as Error).message, 'err'); setBusy(false); }
  }

  if (error) return <div className="alert err">{error}</div>;
  if (!lead) return <div className="loading-block"><span className="spinner" /></div>;
  const details = Object.entries((lead.details || {}) as Record<string, string>).filter(([, v]) => v);
  const ref = lead.property_slug ? { href: `/admin/properties/${lead.property_id}`, label: lead.property_title }
    : lead.project_slug ? { href: `/admin/projects/${lead.project_id}`, label: lead.project_name } : null;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="crumbs"><Link href="/admin/leads">Leads</Link><span>/</span><span>#{lead.id}</span></div>
          <h1>{lead.name}</h1>
          <p>Received {fmtDate(lead.created_at)}{lead.source ? ` from ${lead.source}` : ''}</p>
        </div>
        <div className="actions">
          {lead.phone && <a className="btn" href={`tel:${lead.phone}`}><Phone size={16} />Call</a>}
          {lead.phone && <a className="btn" href={waLink(lead.phone)} target="_blank" rel="noreferrer"><MessageSquare size={16} />WhatsApp</a>}
          {lead.email && <a className="btn" href={`mailto:${lead.email}`}><Mail size={16} />Email</a>}
          {canDelete && <button className="btn btn-danger" onClick={() => setAskDel(true)}><Trash2 size={16} />Delete</button>}
        </div>
      </div>

      <div className="form-layout">
        <div>
          <section className="card">
            <div className="card-head"><h2>Enquiry</h2><span className={`badge ${TONE[lead.status] || ''}`}>{labelOf(LEAD_STATUS, lead.status)}</span></div>
            <div className="card-body">
              <dl className="kv">
                <dt>Name</dt><dd>{lead.name}</dd>
                <dt>Phone</dt><dd>{lead.phone || '—'}</dd>
                <dt>Email</dt><dd>{lead.email || '—'}</dd>
                <dt>Inquiry type</dt><dd>{lead.inquiry_type || '—'}</dd>
                <dt>Property / project</dt><dd>{ref ? <Link className="link" style={{ color: 'var(--accent)' }} href={ref.href}>{ref.label} <ExternalLink size={12} /></Link> : lead.reference_label || '—'}</dd>
                <dt>Source</dt><dd>{lead.source || '—'}</dd>
                {details.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}
              </dl>
              <h3 className="section-title" style={{ marginTop: 22 }}>Message</h3>
              <div className="msg">{lead.message || <span className="muted">No message.</span>}</div>
            </div>
          </section>

          <section className="card">
            <div className="card-head"><div><h2>Internal notes</h2><p>Only visible to admins.</p></div><StickyNote size={18} color="var(--ink-3)" /></div>
            <div className="card-body">
              <form onSubmit={addNote} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <textarea className="textarea" rows={3} maxLength={5000} placeholder="Called, left voicemail. Interested in 3 BHK near Kokapet…" value={note} onChange={(e) => setNote(e.target.value)} aria-label="New note" />
                <div><button className="btn btn-primary" disabled={busy || !note.trim()}>{busy && <span className="spinner" />}Add note</button></div>
              </form>
              <ul className="timeline" style={{ marginTop: 14 }}>
                {lead.notes.map((n: Row) => (
                  <li key={n.id}><div className="by">{n.admin_name || 'Admin'} · {fmtDate(n.created_at)}</div><div className="tx">{n.note}</div></li>
                ))}
                {!lead.notes.length && <li className="muted">No notes yet.</li>}
              </ul>
            </div>
          </section>
        </div>

        <aside className="aside">
          <section className="card">
            <div className="card-head"><h2>Status</h2></div>
            <div className="card-body">
              <div className="status-pills">
                {LEAD_STATUS.map((s) => <button key={s.value} className={lead.status === s.value ? 'on' : ''} onClick={() => setStatus(s.value)}>{s.label}</button>)}
              </div>
              <p className="muted" style={{ margin: '12px 0 0', fontSize: 12.5 }}>Last updated {fmtDate(lead.updated_at)}</p>
            </div>
          </section>
        </aside>
      </div>

      <Confirm open={askDel} busy={busy} title="Delete this lead?" body="The enquiry and its notes will be permanently removed."
        onConfirm={remove} onCancel={() => setAskDel(false)} />
    </>
  );
}
