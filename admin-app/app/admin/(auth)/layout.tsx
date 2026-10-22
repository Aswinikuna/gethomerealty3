import { ShieldCheck } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth">
      <div className="auth-art">
        <span className="pill">Canada · Hyderabad · Visakhapatnam</span>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2>Manage your website content in one place.</h2>
          <p>Listings, projects, reviews, videos, agents and every enquiry from the website — without touching the design.</p>
        </div>
        <span className="pill"><ShieldCheck size={16} /> Authorised staff only</span>
      </div>
      <div className="auth-pane">
        <div className="auth-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo" src="/assets/img/ghr-logo-header.png" alt="Get Home Realty" />
          {children}
          <div className="auth-foot"><ShieldCheck size={14} /> Secure sign-in · sessions expire after 12 hours</div>
        </div>
      </div>
    </div>
  );
}
