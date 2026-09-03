import { get, list, put } from '@vercel/blob';

const PREFIX = 'lottery-history/';
const CURRENT = `${PREFIX}current.json`;
const ACCESS = process.env.BLOB_ACCESS === 'private' ? 'private' : 'public';

export async function readHistory() {
  const { blobs } = await list({ prefix: CURRENT, limit: 1 });
  if (!blobs.length) return null;
  if (ACCESS === 'private') {
    const result = await get(blobs[0].url, { access: 'private' });
    if (!result) return null;
    return JSON.parse(await new Response(result.stream).text());
  }
  const response = await fetch(blobs[0].url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Blob read failed: HTTP ${response.status}`);
  return response.json();
}

export async function writeHistory(data) {
  const blob = await put(CURRENT, JSON.stringify(data), {
    access: ACCESS,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json; charset=utf-8'
  });
  return blob.url;
}
