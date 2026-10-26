import { z } from "zod";
import { SupplierStatus } from "@prisma/client";

export const createSupplierSchema = z.object({
  name: z.string().trim().min(1).max(150),
  email: z.email().nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  status: z.enum(SupplierStatus).optional(),
});

export const updateSupplierSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  email: z.email().nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  status: z.enum(SupplierStatus).optional(),
}).refine((data) => Object.keys(data).some((val) => val !== undefined), "At least one field must be provided");

export const listSuppliersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  status: z.enum(SupplierStatus).optional(),
});

export type CreateSupplierInput = z.output<typeof createSupplierSchema>;

export type UpdateSupplierInput = z.output<typeof updateSupplierSchema>;

export type ListSuppliersInput = z.output<typeof listSuppliersSchema>;
