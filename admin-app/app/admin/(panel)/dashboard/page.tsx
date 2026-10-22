import Link from 'next/link';
import { Activity, Building, Building2, Clapperboard, Inbox, MailOpen, Plus, Star } from 'lucide-react';
import { plain, q } from '@/lib/db';
import { LEAD_STATUS, labelOf } from '@/lib/resources';
import { TimeAgo } from '@/components/TimeAgo';
import { mediaSrc } from '@/lib/format';

export const metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, string> = { new: 'red', contacted: 'info', follow_up: 'warn', qualified: 'ok', closed: 'ok', lost: '' };

export default async function Dashboard() {
  const [[c], leads, props, projects, activity] = await Promise.all([
    q(`select (select count(*)::int from properties) as properties,
              (select count(*)::int from projects) as projects,
              (select count(*)::int from reviews) as reviews,
              (select count(*)::int from videos) as videos,
              (select count(*)::int from leads) as leads,
              (select count(*)::int from leads where status = 'new') as new_leads,
              (select count(*)::int from reviews where not is_approved) as pending_reviews`),
    q(`select id, name, inquiry_type, source, status, created_at from leads order by created_at desc limit 6`),
    q(`select id, title, city, main_image, is_active, created_at from properties order by created_at desc, id desc limit 5`),
    q(`select id, name, location, city, main_image, is_published, created_at from projects order by created_at desc, id desc limit 5`),
    q(`select l.summary, l.created_at, a.name from activity_log l left join admins a on a.id = l.admin_id where l.action <> 'login' order by l.created_at desc limit 8`),
  ]);

  const cards = [
    { label: 'Total Properties', n: c.properties, icon: Building2, href: '/admin/properties' },
    { label: 'Total Projects', n: c.projects, icon: Building, href: '/admin/projects' },
    { label: 'Total Reviews', n: c.reviews, icon: Star, href: '/admin/reviews', sub: c.pending_reviews ? `${c.pending_reviews} awaiting approval` : '' },
    { label: 'Total Videos', n: c.videos, icon: Clapperboard, href: '/admin/videos' },
    { label: 'Total Leads', n: c.leads, icon: Inbox, href: '/admin/leads' },
    { label: 'New Enquiries', n: c.new_leads, icon: MailOpen, href: '/admin/leads?status=new', hl: c.new_leads > 0 },
  ];

  return (
    <>
      <div className="page-head">
        <div><h1>Dashboard</h1><p>An overview of your website content and enquiries.</p></div>
        <div className="actions">
          <Link className="btn" href="/admin/projects/new"><Plus size={16} />Add project</Link>
          <Link className="btn btn-primary" href="/admin/properties/new"><Plus size={16} />Add property</Link>
        </div>
      </div>

      <div className="stats">
        {cards.map((k) => (
          <Link key={k.label} href={k.href} className={`card stat ${k.hl ? 'hl' : ''}`}>
            <span className="ic"><k.icon size={19} /></span>
            <span className="num">{k.n.toLocaleString()}</span>
            <span className="lbl">{k.label}{k.sub && <><br /><span style={{ color: 'var(--warn)' }}>{k.sub}</span></>}</span>
          </Link>
        ))}
      </div>

      <div className="dash-grid">
        <section className="card">
          <div className="card-head"><div><h2>Recent enquiries</h2><p>Latest website form submissions</p></div><Link className="btn btn-sm" href="/admin/leads">View all</Link></div>
          {leads.length ? (
            <ul className="mini-list">
              {leads.map((l) => (
                <li key={l.id}>
                  <div className="grow"><Link className="t" href={`/admin/leads/${l.id}`}>{l.name}</Link>
                    <div className="s">{[l.inquiry_type, l.source].filter(Boolean).join(' · ') || 'Website enquiry'}</div></div>
                  <span className={`badge ${STATUS_TONE[l.status] || ''}`}>{labelOf(LEAD_STATUS, l.status)}</span>
                  <span className="when"><TimeAgo iso={plain(l).created_at} /></span>
                </li>
              ))}
            </ul>
          ) : <div className="empty"><Inbox size={30} /><div>No enquiries yet. Website form submissions will appear here.</div></div>}
        </section>

        <section className="card">
          <div className="card-head"><div><h2>Recent activity</h2><p>Changes made in the admin</p></div><Activity size={18} color="var(--ink-3)" /></div>
          {activity.length ? (
            <ul className="mini-list">
              {activity.map((a, i) => (
                <li key={i}>
                  <div className="grow"><div className="t" style={{ fontWeight: 500, whiteSpace: 'normal' }}>{a.summary}</div>
                    <div className="s">{a.name || 'System'}</div></div>
                  <span className="when"><TimeAgo iso={plain(a).created_at} /></span>
                </li>
              ))}
            </ul>
          ) : <div className="empty">No activity yet.</div>}
        </section>

        <section className="card">
          <div className="card-head"><div><h2>Recently added properties</h2></div><Link className="btn btn-sm" href="/admin/properties">View all</Link></div>
          <ul className="mini-list">
            {props.map((p) => (
              <li key={p.id}>
                <Thumb src={p.main_image} />
                <div className="grow"><Link className="t" href={`/admin/properties/${p.id}`}>{p.title}</Link><div className="s">{p.city}</div></div>
                <span className={`badge ${p.is_active ? 'ok' : ''}`}>{p.is_active ? 'Active' : 'Inactive'}</span>
              </li>
            ))}
            {!props.length && <li className="muted">No properties yet.</li>}
          </ul>
        </section>

        <section className="card">
          <div className="card-head"><div><h2>Recently added projects</h2></div><Link className="btn btn-sm" href="/admin/projects">View all</Link></div>
          <ul className="mini-list">
            {projects.map((p) => (
              <li key={p.id}>
                <Thumb src={p.main_image} />
                <div className="grow"><Link className="t" href={`/admin/projects/${p.id}`}>{p.name}</Link><div className="s">{[p.location, p.city].filter(Boolean).join(', ')}</div></div>
                <span className={`badge ${p.is_published ? 'ok' : ''}`}>{p.is_published ? 'Published' : 'Draft'}</span>
              </li>
            ))}
            {!projects.length && <li className="muted">No projects yet.</li>}
          </ul>
        </section>
      </div>
    </>
  );
}

function Thumb({ src }: { src: string | null }) {
  const url = mediaSrc(src);
  return url
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={url} alt="" loading="lazy" style={{ width: 48, height: 36, objectFit: 'cover', borderRadius: 6, background: 'var(--muted-soft)' }} />
    : <span style={{ width: 48, height: 36, borderRadius: 6, background: 'var(--muted-soft)', display: 'inline-block' }} />;
}
