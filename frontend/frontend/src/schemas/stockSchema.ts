import { z } from 'zod';
import i18n from '../i18n';

export const stockHealthSettingsSchema = z.object({
  availability_weight: z.coerce.number().min(0).max(100),
  rotation_weight: z.coerce.number().min(0).max(100),
}).refine((data) => data.availability_weight + data.rotation_weight === 100, {
  error: () => i18n.t('stock:validation.weights_sum_100'),
  path: ['availability_weight'],
});

export type StockHealthSettingsSchemaType = z.infer<typeof stockHealthSettingsSchema>;
