import { api } from '../../api/client.js';

export const chatApi = {
  list: () =>
    api.get('/conversations', { params: { limit: 50 } }).then((res) => res.data.data.conversations),
  create: (body) => api.post('/conversations', body).then((res) => res.data.data.conversation),
  get: (id) => api.get(`/conversations/${id}`).then((res) => res.data.data),
  remove: (id) => api.delete(`/conversations/${id}`),
};
