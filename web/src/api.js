import { auth } from './firebase';

const BASE_URL = import.meta.env.VITE_API_URL || '';

async function getToken() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken();
}

async function handle(res) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export async function scanImage(imageBase64) {
  const token = await getToken();
  return handle(await fetch(`${BASE_URL}/scan/image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ imageBase64 }),
  }));
}

export async function scanBarcode(upc) {
  const token = await getToken();
  return handle(await fetch(`${BASE_URL}/scan/barcode/${upc}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  }));
}

export async function createCheckoutSession() {
  const token = await getToken();
  return handle(await fetch(`${BASE_URL}/stripe/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  }));
}

export async function createCustomerPortalSession() {
  const token = await getToken();
  return handle(await fetch(`${BASE_URL}/stripe/customer-portal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  }));
}

export async function dismissFlag(ingredientId) {
  const token = await getToken();
  return handle(await fetch(`${BASE_URL}/scan/dismiss`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ ingredientId }),
  }));
}

export async function rematch(rawText) {
  const token = await getToken();
  return handle(await fetch(`${BASE_URL}/scan/rematch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ rawText }),
  }));
}
