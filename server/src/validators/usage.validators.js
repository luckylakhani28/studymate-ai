import { z } from 'zod';

export const usageSchema = {
  query: z.object({ days: z.coerce.number().int().min(1).max(30).default(7) }),
};
