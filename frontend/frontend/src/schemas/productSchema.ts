import { z } from 'zod';

export const productSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  cip1: z.string().optional().nullable(),
  cip2: z.string().optional().nullable(),
  cip3: z.string().optional().nullable(),
  
  selling_price: z.coerce.number().positive("Le prix de vente doit être positif"),
  cost_price: z.coerce.number().min(0, "Le prix d'achat ne peut pas être négatif"),
  
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
  
  description: z.string().optional().nullable(),
  message_alerte: z.string().optional().nullable(),
}).refine((data) => data.selling_price >= data.cost_price, {
  message: "Le prix de vente doit être supérieur ou égal au prix d'achat",
  path: ["selling_price"],
});

export type ProductSchemaType = z.infer<typeof productSchema>;
