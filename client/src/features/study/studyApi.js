import { api } from '../../api/client.js';

export const studyApi = {
  list: (documentId, type) =>
    api
      .get(`/documents/${documentId}/artifacts`, { params: { type, limit: 5 } })
      .then((res) => res.data.data.artifacts),
  request: (documentId, body) =>
    api.post(`/documents/${documentId}/artifacts`, body).then((res) => res.data.data),
};
