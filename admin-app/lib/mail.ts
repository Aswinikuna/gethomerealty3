// Transactional email via Resend's HTTP API. Without RESEND_API_KEY the message is
// written to the server log instead (local development).
export async function sendMail(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`\n[mail → ${to}] ${subject}\n${text}\n`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM || 'Get Home Realty <no-reply@gethomerealty.ca>', to, subject, text }),
  });
  if (!res.ok) console.error('sendMail failed', res.status, await res.text().catch(() => ''));
}
