'use client';
import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { api, ApiError } from './api';
import { FieldWrap, useToast } from './ui';

function Pw({ id, value, onChange, invalid, autoComplete }: { id: string; value: string; onChange: (v: string) => void; invalid?: boolean; autoComplete: string }) {
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

/** Rough strength hint (length + variety) — the server enforces the actual rule. */
function strength(pw: string) {
  if (!pw) return null;
  let s = 0;
  if (pw.length >= 12) s++;
  if (pw.length >= 16) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s <= 2 ? { label: 'Weak', color: 'var(--accent)' } : s <= 3 ? { label: 'Fair', color: 'var(--warn)' } : { label: 'Strong', color: 'var(--ok)' };
}

export default function ChangePassword({ email }: { email: string }) {
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const st = strength(next);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!current) errs.current = 'Enter your current password.';
    if (next.length < 12) errs.next = 'Use at least 12 characters.';
    else if (!/[A-Za-z]/.test(next) || !/[^A-Za-z]/.test(next)) errs.next = 'Mix letters with numbers or symbols.';
    if (next !== confirm) errs.confirm = 'Passwords don’t match.';
    setErrors(errs); setDone(false);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await api('/api/auth/change-password', { body: { current, next } });
      setCurrent(''); setNext(''); setConfirm(''); setDone(true);
      toast('Password changed');
    } catch (err) {
      const ae = err as ApiError;
      setErrors(Object.keys(ae.fields || {}).length ? ae.fields : { _: ae.message });
    } finally { setBusy(false); }
  }

  return (
    <>
      <div className="page-head"><div><h1>My account</h1><p>Signed in as {email}</p></div></div>
      <section className="card" style={{ maxWidth: 560 }}>
        <div className="card-head"><div><h2>Change password</h2><p>You’ll stay signed in here; other devices are signed out.</p></div><KeyRound size={18} color="var(--ink-3)" /></div>
        <div className="card-body">
          <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {done && <div className="alert ok" role="status">Your password has been changed.</div>}
            {errors._ && <div className="alert err" role="alert">{errors._}</div>}
            <input type="text" autoComplete="username" value={email} readOnly hidden />
            <FieldWrap label="Current password" htmlFor="cp-current" error={errors.current}>
              <Pw id="cp-current" value={current} onChange={setCurrent} invalid={!!errors.current} autoComplete="current-password" />
            </FieldWrap>
            <FieldWrap label="New password" htmlFor="cp-next" error={errors.next} help="At least 12 characters, mixing letters with numbers or symbols.">
              <Pw id="cp-next" value={next} onChange={setNext} invalid={!!errors.next} autoComplete="new-password" />
              {st && !errors.next && <span className="help" style={{ color: st.color, fontWeight: 600 }}>Strength: {st.label}</span>}
            </FieldWrap>
            <FieldWrap label="Confirm new password" htmlFor="cp-confirm" error={errors.confirm}>
              <Pw id="cp-confirm" value={confirm} onChange={setConfirm} invalid={!!errors.confirm} autoComplete="new-password" />
            </FieldWrap>
            <div><button className="btn btn-primary" disabled={busy}>{busy && <span className="spinner" />}Change password</button></div>
          </form>
        </div>
      </section>
    </>
  );
}
