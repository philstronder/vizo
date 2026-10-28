import { z } from "zod";

// Request schemas shared by more than one router.

export const deliveryAddressSchema = z.object({
  postalCode: z.string().trim().min(1, "Postal code is required"),
  street: z.string().trim().min(1, "Street is required"),
  number: z.string().trim().min(1, "Number is required"),
  complement: z.string().trim().optional(),
  district: z.string().trim().min(1, "District is required"),
  city: z.string().trim().min(1, "City is required"),
  state: z.string().trim().min(1, "State is required"),
});

// Added by admins, or by a resident at sign-up when theirs is missing from the
// list. A condominium's address has no complement.
export const condominiumSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  address: deliveryAddressSchema.omit({ complement: true }),
});
