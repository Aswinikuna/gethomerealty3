import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export const json = (data: unknown, init?: number | ResponseInit) =>
  NextResponse.json(data, typeof init === 'number' ? { status: init } : init);

export const fail = (status: number, error: string, extra?: Record<string, unknown>) =>
  NextResponse.json({ error, ...extra }, { status });

export class HttpError extends Error {
  constructor(public status: number, message: string, public fields?: Record<string, string>) { super(message); }
}

/** Turn thrown errors into JSON responses (never leaks internals). */
export function handle(e: unknown) {
  if (e instanceof HttpError) return fail(e.status, e.message, e.fields ? { fields: e.fields } : undefined);
  if (e instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const i of e.issues) fields[i.path.join('.') || '_'] ??= i.message;
    return fail(422, 'Please fix the highlighted fields.', { fields });
  }
  const code = (e as { code?: string })?.code;
  if (code === '23505') return fail(409, 'That value is already in use (must be unique).');
  if (code === '23503') return fail(409, 'This record is referenced by other data.');
  console.error(e);
  return fail(500, 'Something went wrong. Please try again.');
}

/** Read a JSON body with a size cap. */
export async function readJson(req: Request, maxBytes = 256 * 1024): Promise<any> {
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, 'Request is too large.');
  try { return text ? JSON.parse(text) : {}; } catch { throw new HttpError(400, 'Invalid JSON.'); }
}

export function clientIp(req: Request) {
  return (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
}
