import { api } from '../../api/client.js';

export const documentsApi = {
  list: (params) =>
    api.get('/documents', { params }).then((res) => ({ ...res.data.data, meta: res.data.meta })),

  get: (id) => api.get(`/documents/${id}`).then((res) => res.data.data.document),

  chunks: (id, params) =>
    api
      .get(`/documents/${id}/chunks`, { params })
      .then((res) => ({ ...res.data.data, meta: res.data.meta })),

  upload: (file, { onProgress } = {}) => {
    const body = new FormData();
    body.append('file', file);
    return api
      .post('/documents', body, {
        timeout: 0, // large files on slow campus Wi-Fi must not hit the 20s default
        onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)),
      })
      .then((res) => res.data.data.document);
  },

  reprocess: (id) => api.post(`/documents/${id}/reprocess`).then((res) => res.data.data.document),

  remove: (id) => api.delete(`/documents/${id}`),

  /** The file route needs the Bearer token, so a plain <a href> won't work: fetch as a blob instead. */
  fileUrl: async (id) => {
    const res = await api.get(`/documents/${id}/file`, { responseType: 'blob' });
    return URL.createObjectURL(res.data);
  },
};
