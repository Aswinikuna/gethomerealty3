import { requireAdmin } from '@/lib/auth';
import { fail, handle, json } from '@/lib/http';
import { IMAGE_MAX_BYTES, PDF_MAX_BYTES, signedPdfUpload, storeUpload, type UploadKind } from '@/lib/storage';

/** multipart/form-data: file=<File>, kind=image|pdf → { url } */
export async function POST(req: Request) {
  try {
    await requireAdmin(req);
    const sp = new URL(req.url).searchParams;
    const kind = sp.get('kind') === 'pdf' ? 'pdf' : 'image' as UploadKind;
    const name = (sp.get('name') || '').slice(0, 100);
    const cap = (kind === 'pdf' ? PDF_MAX_BYTES : IMAGE_MAX_BYTES) + 64 * 1024;
    if (Number(req.headers.get('content-length') || 0) > cap) return fail(413, kind === 'pdf' ? 'PDF is larger than 30 MB.' : 'Image is larger than 10 MB.');
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) return fail(400, 'Choose a file to upload.');
    // Name: the editor's hint (e.g. project name), else the original file name unless it's a camera default like IMG_1234.
    const original = file.name.replace(/\.[^.]+$/, '');
    const hint = name || (/^(img|dsc|image|photo|screenshot|pxl|whatsapp)[\s_-]*\d/i.test(original) ? '' : original);
    return json(await storeUpload(Buffer.from(await file.arrayBuffer()), kind, hint), 201);
  } catch (e) { return handle(e); }
}

/** Large PDFs: ask for a one-time signed URL and upload straight to storage. */
export async function PUT(req: Request) {
  try {
    await requireAdmin(req);
    const signed = await signedPdfUpload((new URL(req.url).searchParams.get('name') || '').slice(0, 100));
    return json(signed ? { mode: 'signed', ...signed } : { mode: 'direct' });
  } catch (e) { return handle(e); }
}
