const BASE_URL = import.meta.env.VITE_API_URL || '';

async function handle(res) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export async function scanImage(imageBase64) {
  return handle(await fetch(`${BASE_URL}/scan/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64 }),
  }));
}

export async function scanBarcode(upc) {
  return handle(await fetch(`${BASE_URL}/scan/barcode/${upc}`));
}
