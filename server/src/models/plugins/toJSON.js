const deletePath = (obj, path) => {
  const keys = path.split('.');
  const last = keys.pop();
  const parent = keys.reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);
  if (parent && typeof parent === 'object') delete parent[last];
};

/**
 * Consistent API shape for every model: `_id` → `id`, no `__v`,
 * and listed fields (dot paths allowed) never leave the server.
 */
export function toJSON(schema, { hide = [] } = {}) {
  schema.set('toJSON', {
    versionKey: false,
    transform(_doc, ret) {
      ret.id = String(ret._id);
      delete ret._id;
      hide.forEach((path) => deletePath(ret, path));
      return ret;
    },
  });
}
