import { assertSameOrigin, destroySession } from '@/lib/auth';
import { handle, json } from '@/lib/http';

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await destroySession();
    return json({ ok: true });
  } catch (e) { return handle(e); }
}
