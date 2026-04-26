import { z } from 'zod';

export const clientSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  phone: z.string().optional().nullable().refine((val) => {
    if (!val) return true;
    return /^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s\./0-9]*$/.test(val) && val.replace(/\D/g, '').length >= 8;
  }, "Numéro de téléphone invalide (min. 8 chiffres)"),
  
  email: z.string().email("Format d'email invalide").optional().or(z.literal('')).nullable(),
  address: z.string().optional().nullable(),
  
  remise_automatique: z.coerce.number().min(0).max(100, "La remise ne peut pas dépasser 100%").default(0),
  plafond: z.coerce.number().min(0).default(0),
  taux_couverture: z.coerce.number().min(0).max(100).default(0),
  
  is_active: z.boolean().default(true),
  is_deposit_enabled: z.boolean().default(false),
  
  client_type: z.enum(['PARTICULIER', 'PROFESSIONNEL']).default('PARTICULIER'),
  ayants_droit: z.array(z.any()).optional().default([]),
});

export const facturationClientCreateSchema = z.object({
  client_type: z.enum(['PARTICULIER', 'PROFESSIONNEL']).default('PARTICULIER'),
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères"),
  phone: z.string().trim().min(8, "Le téléphone doit contenir au moins 8 caractères"),
  email: z.string().trim().email("Format d'email invalide"),
  address: z.string().trim().min(3, "L'adresse doit contenir au moins 3 caractères"),
  plafond: z.coerce.number().min(0, 'Le plafond ne peut pas être négatif').default(0),
  taux_couverture: z.coerce.number().min(0).max(100, 'Le taux de couverture doit être entre 0 et 100').default(0),
  remise_automatique: z.coerce.number().min(0).max(100, 'La remise automatique doit être entre 0 et 100').default(0),
  is_loyalty_member: z.boolean().default(true),
});

export type ClientSchemaType = z.infer<typeof clientSchema>;
export type FacturationClientCreateSchemaType = z.infer<typeof facturationClientCreateSchema>;
