import { api } from '../../api/client.js';

export const authApi = {
  login: (body) => api.post('/auth/login', body).then((res) => res.data.data),
  register: (body) => api.post('/auth/register', body).then((res) => res.data.data),
  logout: () => api.post('/auth/logout'),
};
