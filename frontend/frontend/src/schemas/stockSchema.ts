import { z } from 'zod';

export const stockHealthSettingsSchema = z.object({
  availability_weight: z.coerce.number().min(0).max(100),
  rotation_weight: z.coerce.number().min(0).max(100),
}).refine((data) => data.availability_weight + data.rotation_weight === 100, {
  message: 'La somme des pondérations doit être égale a 100',
  path: ['availability_weight'],
});

export type StockHealthSettingsSchemaType = z.infer<typeof stockHealthSettingsSchema>;
