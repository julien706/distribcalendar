import { z } from 'zod';

export const addressSchema = z.object({
  street_name: z.string().trim().min(1, "Le nom de rue est requis").max(200, "Le nom de rue est trop long"),
  street_number: z.string().trim().max(20, "Le numéro est trop long").optional(),
  city: z.string().trim().max(100, "Le nom de ville est trop long").optional(),
  latitude: z.number().min(-90, "Latitude invalide").max(90, "Latitude invalide"),
  longitude: z.number().min(-180, "Longitude invalide").max(180, "Longitude invalide"),
  observations: z.string().trim().max(1000, "Les observations sont trop longues (max 1000 caractères)").optional(),
  status: z.enum(['pending', 'done', 'refused', 'retry_first', 'retry_second', 'uninhabited'])
});

export const authSchema = z.object({
  email: z.string().trim().email("Email invalide").max(255, "Email trop long"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères").max(72, "Mot de passe trop long")
});

export type AddressInput = z.infer<typeof addressSchema>;
export type AuthInput = z.infer<typeof authSchema>;
