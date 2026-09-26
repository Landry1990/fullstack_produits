import { z } from 'zod';
import i18n from '../i18n';

export const productSchema = z.object({
  name: z.string().min(2, { error: () => i18n.t('products:form.validation.name_min') }),
  cip1: z.string().optional().nullable(),
  cip2: z.string().optional().nullable(),
  cip3: z.string().optional().nullable(),
  cip4: z.string().optional().nullable(),
  
  selling_price: z.coerce.number().positive({ error: () => i18n.t('products:form.validation.selling_price_positive') }),
  cost_price: z.coerce.number().min(0, { error: () => i18n.t('products:form.validation.cost_price_negative') }),
  
  tva: z.coerce.number().min(0).max(100).default(0),
  
  stock_minimum: z.coerce.number().min(0).default(0),
  stock: z.coerce.number().min(0).default(0),
  stock_alert: z.coerce.number().min(0).default(0),
  stock_maximum: z.coerce.number().min(0).default(0),
  
  rayon: z.coerce.number().nullable().optional(),
  fournisseur: z.coerce.number().nullable().optional(),
  forme: z.coerce.number().nullable().optional(),
  groupe: z.coerce.number().nullable().optional(),
  
  is_active: z.boolean().default(true),
  use_lot_management: z.boolean().default(true),
  has_reserve_storage: z.boolean().default(false),
  
  min_rayon: z.coerce.number().min(0).optional(),
  capacite_rayon: z.coerce.number().min(0).optional(),
  
  expire_date: z.string().optional().nullable(),

  description: z.string().optional().nullable(),
  message_alerte: z.string().optional().nullable(),
  
  // DCI / Clinique
  substances: z.array(z.number()).optional(),
  dci_reference: z.coerce.number().nullable().optional(),
  is_generic: z.boolean().default(false),
  produit_reference: z.coerce.number().nullable().optional(),
  code_atc: z.string().optional().nullable(),
  substance_active: z.string().optional().nullable(),
}).refine((data) => data.selling_price >= data.cost_price, {
  error: () => i18n.t('products:form.validation.selling_below_cost'),
  path: ["selling_price"],
});

export type ProductSchemaType = z.infer<typeof productSchema>;
