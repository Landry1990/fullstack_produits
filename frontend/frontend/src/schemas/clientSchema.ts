import { z } from 'zod';
import i18n from '../i18n';

export const clientSchema = z.object({
  name: z.string().min(2, { error: () => i18n.t('clients:validation.name_min') }),
  phone: z.string().optional().nullable().refine((val) => {
    if (!val) return true;
    return /^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s./0-9]*$/.test(val) && val.replace(/\D/g, '').length >= 8;
  }, { error: () => i18n.t('clients:validation.phone_invalid') }),

  email: z.string().email({ error: () => i18n.t('clients:validation.email_invalid') }).optional().or(z.literal('')).nullable(),
  address: z.string().optional().nullable(),
  niu: z.string().optional().nullable(),
  registre_commerce: z.string().optional().nullable(),

  remise_automatique: z.coerce.number().min(0).max(100, { error: () => i18n.t('clients:validation.remise_max') }).default(0),
  plafond: z.coerce.number().min(-1).default(-1),
  taux_couverture: z.coerce.number().min(0).max(100).default(0),
  majoration_pro_pourcentage: z.coerce.number().min(0).max(100).default(0),
  
  is_active: z.boolean().default(true),
  is_deposit_enabled: z.boolean().default(false),
  
  client_type: z.enum(['PARTICULIER', 'PROFESSIONNEL']).default('PARTICULIER'),
  ayants_droit: z.array(z.any()).optional().default([]),
});

export const facturationClientCreateSchema = z.object({
  client_type: z.enum(['PARTICULIER', 'PROFESSIONNEL']).default('PARTICULIER'),
  name: z.string().trim().min(2, { error: () => i18n.t('clients:validation.name_min') }),
  phone: z.string().trim().optional().nullable().refine((val) => {
    if (!val) return true;
    return /^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s./0-9]*$/.test(val) && val.replace(/\D/g, '').length >= 8;
  }, { error: () => i18n.t('clients:validation.phone_invalid') }),
  email: z.string().trim().email({ error: () => i18n.t('clients:validation.email_invalid') }).optional().or(z.literal('')).nullable(),
  address: z.string().trim().optional().nullable(),
  plafond: z.coerce.number().min(-1, { error: () => i18n.t('clients:validation.plafond_min') }).default(-1),
  taux_couverture: z.coerce.number().min(0).max(100, { error: () => i18n.t('clients:validation.taux_couverture_range') }).default(0),
  remise_automatique: z.coerce.number().min(0).max(100, { error: () => i18n.t('clients:validation.remise_auto_range') }).default(0),
  majoration_pro_pourcentage: z.coerce.number().min(0).max(100, { error: () => i18n.t('clients:validation.majoration_range') }).default(0),
  is_loyalty_member: z.boolean().default(true),
});

export type ClientSchemaType = z.infer<typeof clientSchema>;
export type FacturationClientCreateSchemaType = z.infer<typeof facturationClientCreateSchema>;
