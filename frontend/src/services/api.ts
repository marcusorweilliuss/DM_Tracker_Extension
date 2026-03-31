const API_BASE = '/api';

function getToken(): string | null {
  const auth = localStorage.getItem('auth');
  if (!auth) return null;
  return JSON.parse(auth).token;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    localStorage.removeItem('auth');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: { id: string; email: string; name: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string, name: string) =>
    request<{ token: string; user: { id: string; email: string; name: string } }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),

  getConversations: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any[]>(`/conversations${qs}`);
  },

  getConversation: (id: string) =>
    request<any>(`/conversations/${id}`),

  updateConversationStatus: (id: string, status: string) =>
    request<any>(`/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  getContacts: () => request<any[]>('/contacts'),

  getContact: (id: string) => request<any>(`/contacts/${id}`),

  getUsers: () => request<{ id: string; email: string; name: string }[]>('/users'),
};
