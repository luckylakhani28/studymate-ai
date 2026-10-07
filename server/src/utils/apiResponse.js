export const ok = (res, data, { status = 200, meta } = {}) =>
  res.status(status).json({ success: true, data, ...(meta && { meta }) });

export const created = (res, data) => ok(res, data, { status: 201 });

export const noContent = (res) => res.status(204).end();
