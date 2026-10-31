export type Role = 'admin' | 'supervisor' | 'incharge';
export type Session = { token: string; role: Role; user: { id?: string | null; name?: string | null; email?: string | null; role: Role } };
const apiUrl = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/$/, '');
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) throw new Error(body.message || 'Something went wrong.');
  return body as T;
}
export const api = {
  sendOtp: (username: string) => request<{ devOtp?: string }>('/api/otp/send', { method: 'POST', body: JSON.stringify({ username }) }),
  verifyOtp: (username: string, otp: string) => request<Session>('/api/otp/verify', { method: 'POST', body: JSON.stringify({ username, otp }) }),
  tickets: (token: string) => request<{ tickets: unknown[] }>('/api/tickets', { headers: { Authorization: `Bearer ${token}` } }),
  ticket: (token: string, id: string) => request<{ ticket: any }>(`/api/tickets/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
  comment: (token: string, id: string, author: string, text: string) => request<{ ticket: any }>(`/api/tickets/${id}/comments`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ author, text }) }),
  createTicket: async (token: string, fields: Record<string, string>, image?: { uri: string; mimeType?: string | null; fileName?: string | null }) => {
    const form = new FormData();
    Object.entries(fields).forEach(([key, value]) => form.append(key, value));
    if (image) form.append('images', { uri: image.uri, type: image.mimeType || 'image/jpeg', name: image.fileName || 'ticket-photo.jpg' } as any);
    const response = await fetch(`${apiUrl}/api/tickets`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.success === false) throw new Error(body.message || 'Could not create ticket.');
    return body as { ticket: any };
  },
};
export const configuredApiUrl = apiUrl;
