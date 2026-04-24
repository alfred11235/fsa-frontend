import axios from 'axios';

export const apiClient = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

function getStoredToken(): string | null {
  return localStorage.getItem('fsa_ip_token') ?? localStorage.getItem('fsa_token');
}

apiClient.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('fsa_token');
      localStorage.removeItem('fsa_ip_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);
