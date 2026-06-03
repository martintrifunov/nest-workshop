import axios from 'axios';

const nestClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
});

nestClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

nestClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const method = err.config?.method?.toLowerCase();
    // Only force-logout on 401 from read requests (GET/HEAD).
    // For mutations (POST/PUT/PATCH/DELETE) let the component handle the error
    // so the user sees a message instead of silently losing their work.
    if (status === 401 && (method === 'get' || method === 'head')) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export default nestClient;
