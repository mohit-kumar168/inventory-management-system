import { z } from "zod";
import { AddressLabel } from "@prisma/client";

export const createAddressSchema = z.object({
  label: z.enum(AddressLabel).optional(),
  recipientName: z.string().trim().min(1).max(150),
  phone: z.string().trim().max(30).nullable().optional(),
  line1: z.string().trim().min(1).max(255),
  line2: z.string().trim().max(255).nullable().optional(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().min(1).max(20),
  country: z.string().trim().min(2).max(100).optional(),
  isDefault: z.boolean().optional(),
});

export const updateAddressSchema = z
  .object({
    label: z.enum(AddressLabel).optional(),
    recipientName: z.string().trim().min(1).max(150).optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    line1: z.string().trim().min(1).max(255).optional(),
    line2: z.string().trim().max(255).nullable().optional(),
    city: z.string().trim().min(1).max(100).optional(),
    state: z.string().trim().min(1).max(100).optional(),
    postalCode: z.string().trim().min(1).max(20).optional(),
    country: z.string().trim().min(2).max(100).optional(),
    isDefault: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).some((val) => val !== undefined),
    "At least one field must be provided"
  );

export type CreateAddressInput = z.output<typeof createAddressSchema>;
export type UpdateAddressInput = z.output<typeof updateAddressSchema>;

