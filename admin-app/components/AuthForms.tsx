'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { CircleAlert, CircleCheck, Eye, EyeOff } from 'lucide-react';
import { api, ApiError } from './api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function PasswordInput({ id, value, onChange, invalid, autoComplete }: {
  id: string; value: string; onChange: (v: string) => void; invalid?: boolean; autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw-wrap">
      <input id={id} className={`input ${invalid ? 'invalid' : ''}`} type={show ? 'text' : 'password'} value={value}
        autoComplete={autoComplete} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid || undefined} />
      <button type="button" className="icon-btn" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

function Alert({ kind, children }: { kind: 'err' | 'ok'; children: React.ReactNode }) {
  return (
    <div className={`alert ${kind}`} role={kind === 'err' ? 'alert' : 'status'}>
      {kind === 'err' ? <CircleAlert size={18} /> : <CircleCheck size={18} />}<span>{children}</span>
    </div>
  );
}

/** Only same-app admin paths are allowed as a post-login destination. */
const safeNext = (n: string | null) => (n && /^\/admin\/[\w\-/]*$/.test(n) && !n.startsWith('/admin/login') ? n : '/admin/dashboard');

export function LoginForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!EMAIL_RE.test(email.trim())) errs.email = 'Enter a valid email address.';
    if (!password) errs.password = 'Enter your password.';
    setErrors(errs); setError('');
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await api('/api/auth/login', { body: { email, password } });
      router.replace(safeNext(next));
      router.refresh();
    } catch (err) {
      setError((err as ApiError).message);
      if ((err as ApiError).fields) setErrors((err as ApiError).fields);
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Admin sign in</h1>
      <p className="sub">Sign in to manage the Get Home Realty website.</p>
      <form onSubmit={submit} noValidate>
        {error && <Alert kind="err">{error}</Alert>}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" className={`input ${errors.email ? 'invalid' : ''}`} type="email" autoComplete="username" value={email}
            onChange={(e) => setEmail(e.target.value)} autoFocus aria-invalid={!!errors.email || undefined} />
          {errors.email && <span className="err">{errors.email}</span>}
        </div>
        <div className="field">
          <div className="row"><label htmlFor="password" style={{ fontWeight: 600, fontSize: 13 }}>Password</label>
            <Link className="link" href="/admin/forgot-password">Forgot password?</Link></div>
          <PasswordInput id="password" value={password} onChange={setPassword} invalid={!!errors.password} autoComplete="current-password" />
          {errors.password && <span className="err">{errors.password}</span>}
        </div>
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy && <span className="spinner" />}{busy ? 'Signing in…' : 'Login'}
        </button>
      </form>
    </>
  );
}

export function ForgotForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) return setError('Enter a valid email address.');
    setBusy(true); setError('');
    try {
      const r = await api<{ message: string }>('/api/auth/forgot', { body: { email } });
      setDone(r.message);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return (
    <>
      <h1>Reset your password</h1>
      <p className="sub">Enter your admin email and we’ll send you a reset link.</p>
      <form onSubmit={submit} noValidate>
        {error && <Alert kind="err">{error}</Alert>}
        {done ? <Alert kind="ok">{done}</Alert> : (
          <>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" className={`input ${error ? 'invalid' : ''}`} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </div>
            <button className="btn btn-primary btn-block" disabled={busy}>{busy && <span className="spinner" />}Send reset link</button>
          </>
        )}
        <Link className="link" href="/admin/login">← Back to sign in</Link>
      </form>
    </>
  );
}

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (pw.length < 12) errs.password = 'Use at least 12 characters.';
    else if (!/[A-Za-z]/.test(pw) || !/[^A-Za-z]/.test(pw)) errs.password = 'Mix letters with numbers or symbols.';
    if (pw !== pw2) errs.confirm = 'Passwords don’t match.';
    setErrors(errs); setError('');
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await api('/api/auth/reset', { body: { token, password: pw } });
      setDone(true);
      setTimeout(() => router.replace('/admin/login'), 2000);
    } catch (err) {
      setError((err as ApiError).message);
      setErrors((err as ApiError).fields || {});
    } finally { setBusy(false); }
  }

  if (!token) return <><h1>Reset link missing</h1><p className="sub">Open the link from your email again, or request a new one.</p><Link className="link" href="/admin/forgot-password">Request a new link</Link></>;
  return (
    <>
      <h1>Choose a new password</h1>
      <p className="sub">At least 12 characters, mixing letters with numbers or symbols.</p>
      <form onSubmit={submit} noValidate>
        {error && <Alert kind="err">{error}</Alert>}
        {done ? <Alert kind="ok">Password updated. Taking you to sign in…</Alert> : (
          <>
            <div className="field">
              <label htmlFor="pw">New password</label>
              <PasswordInput id="pw" value={pw} onChange={setPw} invalid={!!errors.password} autoComplete="new-password" />
              {errors.password && <span className="err">{errors.password}</span>}
            </div>
            <div className="field">
              <label htmlFor="pw2">Confirm password</label>
              <PasswordInput id="pw2" value={pw2} onChange={setPw2} invalid={!!errors.confirm} autoComplete="new-password" />
              {errors.confirm && <span className="err">{errors.confirm}</span>}
            </div>
            <button className="btn btn-primary btn-block" disabled={busy}>{busy && <span className="spinner" />}Update password</button>
          </>
        )}
        <Link className="link" href="/admin/login">← Back to sign in</Link>
      </form>
    </>
  );
}
