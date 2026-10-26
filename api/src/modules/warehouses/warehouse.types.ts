
import { z } from "zod";
import { WarehouseStatus } from "@prisma/client";

export const createWarehouseSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(150),
  addressLine1: z.string().trim().max(200).nullable().optional(),
  addressLine2: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  state: z.string().trim().max(100).nullable().optional(),
  postalCode: z.string().trim().max(20).nullable().optional(),
  country: z.string().trim().length(2).default("IN"),
  status: z.enum(WarehouseStatus).optional(),
});

export const updateWarehouseSchema = z
  .object({
    code: z.string().trim().min(1).max(50).optional(),
    name: z.string().trim().min(1).max(150).optional(),
    addressLine1: z.string().trim().max(200).nullable().optional(),
    addressLine2: z.string().trim().max(200).nullable().optional(),
    city: z.string().trim().max(100).nullable().optional(),
    state: z.string().trim().max(100).nullable().optional(),
    postalCode: z.string().trim().max(20).nullable().optional(),
    country: z.string().trim().length(2).optional(),
    status: z.enum(WarehouseStatus).optional(),
  })
  .refine((data) => Object.keys(data).some((val) => val !== undefined),
    "At least one field must be provided"
  );

export const listWarehousesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  city: z.string().trim().optional(),
  status: z.enum(WarehouseStatus).optional(),
});

export type CreateWarehouseInput = z.output<typeof createWarehouseSchema>;
export type UpdateWarehouseInput = z.output<typeof updateWarehouseSchema>;
export type ListWarehousesInput = z.output<typeof listWarehousesSchema>;

