'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  Building, Building2, KeyRound, MapPin, Clapperboard, ExternalLink, House, Inbox, LayoutDashboard, LogOut, Menu,
  PanelLeftClose, PanelLeftOpen, Phone, Settings, Share2, Star, Users, X,
} from 'lucide-react';
import { api, setCsrf } from './api';
import { ToastProvider } from './ui';

const RoleCtx = createContext<string>('editor');
/** The signed-in admin's role ('admin' | 'editor'). Internal prices are shown to 'admin' only. */
export const useRole = () => useContext(RoleCtx);

const NAV = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { group: 'Website content' },
  { href: '/admin/homepage', label: 'Homepage', icon: House },
  { href: '/admin/properties', label: 'Properties', icon: Building2 },
  { href: '/admin/projects', label: 'Projects', icon: Building },
  { href: '/admin/videos', label: 'Videos', icon: Clapperboard },
  { href: '/admin/reviews', label: 'Reviews', icon: Star },
  { href: '/admin/agents', label: 'Agents', icon: Users },
  { href: '/admin/locations', label: 'Locations', icon: MapPin },
  { group: 'Sales' },
  { href: '/admin/leads', label: 'Leads / Enquiries', icon: Inbox, badge: true },
  { group: 'Business' },
  { href: '/admin/contact', label: 'Contact Details', icon: Phone },
  { href: '/admin/social', label: 'Social Media', icon: Share2 },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
  { href: '/admin/account', label: 'My account', icon: KeyRound },
] as const;

export default function AdminShell({ admin, csrf, newLeads, children }: {
  admin: { name: string; email: string; role: string }; csrf: string; newLeads: number; children: ReactNode;
}) {
  setCsrf(csrf);
  const path = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => { try { setCollapsed(localStorage.getItem('ghr-admin-collapsed') === '1'); } catch { /* private mode */ } }, []);
  useEffect(() => { setDrawer(false); }, [path]);
  useEffect(() => {
    if (!drawer) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false);
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [drawer]);

  const toggleCollapse = () => {
    setCollapsed((c) => {
      try { localStorage.setItem('ghr-admin-collapsed', c ? '0' : '1'); } catch { /* ignore */ }
      return !c;
    });
  };

  async function logout() {
    setLeaving(true);
    try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* cookie is cleared server-side anyway */ }
    router.replace('/admin/login');
    router.refresh();
  }

  const initials = (admin.name || admin.email).split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  return (
    <RoleCtx.Provider value={admin.role}>
    <ToastProvider>
      <div className={`shell ${collapsed ? 'collapsed' : ''} ${drawer ? 'drawer-open' : ''}`}>
        <aside className="side" aria-label="Admin navigation">
          <div className="side-brand">
            <div className="mark">GHR</div>
            <div className="tag-wrap"><div style={{ fontWeight: 700, lineHeight: 1.1 }}>Get Home Realty</div><div className="tag">Admin</div></div>
            <button className="icon-btn only-mobile" style={{ marginLeft: 'auto' }} onClick={() => setDrawer(false)} aria-label="Close menu"><X size={18} /></button>
          </div>
          <nav className="side-nav">
            {NAV.map((n, i) => {
              if ('group' in n) return <div className="side-group" key={i}>{n.group}</div>;
              const Icon = n.icon;
              const active = path === n.href || path.startsWith(n.href + '/');
              return (
                <Link key={n.href} href={n.href} className={`side-link ${active ? 'active' : ''}`} title={collapsed ? n.label : undefined} aria-current={active ? 'page' : undefined}>
                  <Icon size={18} /><span className="lbl">{n.label}</span>
                  {'badge' in n && newLeads > 0 && <span className="count">{newLeads > 99 ? '99+' : newLeads}</span>}
                </Link>
              );
            })}
          </nav>
          <div className="side-foot">
            <a className="side-link" href="/" target="_blank" rel="noreferrer" title={collapsed ? 'View website' : undefined}><ExternalLink size={18} /><span className="lbl">View website</span></a>
            <button className="side-link" onClick={logout} disabled={leaving} title={collapsed ? 'Logout' : undefined}>
              <LogOut size={18} /><span className="lbl">{leaving ? 'Signing out…' : 'Logout'}</span>
            </button>
          </div>
        </aside>
        <div className="scrim" onClick={() => setDrawer(false)} />
        <div className="main">
          <header className="topbar">
            <button className="icon-btn only-mobile" onClick={() => setDrawer(true)} aria-label="Open menu"><Menu size={20} /></button>
            <button className="icon-btn only-desktop" onClick={toggleCollapse} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
            </button>
            <div className="grow" />
            <Link className="who" href="/admin/account" title="My account / change password">
              <div className="meta" style={{ textAlign: 'right' }}>
                <div className="name">{admin.name || admin.email}</div>
                <div className="role">{admin.role === 'admin' ? 'Administrator' : 'Editor'}</div>
              </div>
              <div className="avatar" aria-hidden>{initials}</div>
            </Link>
          </header>
          <main className="content">{children}</main>
        </div>
      </div>
    </ToastProvider>
    </RoleCtx.Provider>
  );
}
