const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `Erreur ${res.status}`);
  }
  return res.json();
}

export const formatPrice = (cents: number) => `${(cents / 100).toFixed(2).replace('.', ',')} €`;
