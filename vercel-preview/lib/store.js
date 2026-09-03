import { get, list, put } from '@vercel/blob';

const PREFIX = 'lottery-history/';
const CURRENT = `${PREFIX}current.json`;

export async function readHistory() {
  const { blobs } = await list({ prefix: CURRENT, limit: 1 });
  if (!blobs.length) return null;

  try {
    const response = await fetch(blobs[0].url, { cache: 'no-store' });
    if (response.ok) return response.json();
  } catch (_) {}

  const result = await get(blobs[0].url, { access: 'private' });
  if (!result) return null;
  return JSON.parse(await new Response(result.stream).text());
}

async function putWithAccess(data, access) {
  return put(CURRENT, JSON.stringify(data), {
    access,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json; charset=utf-8'
  });
}

export async function writeHistory(data) {
  if (process.env.BLOB_ACCESS === 'private') return (await putWithAccess(data, 'private')).url;
  if (process.env.BLOB_ACCESS === 'public') return (await putWithAccess(data, 'public')).url;

  try {
    return (await putWithAccess(data, 'public')).url;
  } catch (publicError) {
    try {
      return (await putWithAccess(data, 'private')).url;
    } catch (privateError) {
      throw new Error(`Blob write failed in public and private modes: ${publicError.message}; ${privateError.message}`);
    }
  }
}
