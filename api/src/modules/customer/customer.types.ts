import { CustomerStatus } from "@prisma/client";
import { z } from "zod";

export const createCustomerSchema = z.object({
  firstName: z.string().trim().min(1).max(150),
  lastName: z.string().trim().min(1).max(150),
  email: z.email(),
  phone: z.string().trim().max(30),
  status: z.enum(CustomerStatus).optional(),
});

export const updateCustomerSchema = z.object({
  firstName: z.string().trim().min(1).max(150).optional(),
  lastName: z.string().trim().min(1).max(150).optional(),
  email: z.email().optional(),
  phone: z.string().trim().max(30).optional(),
  status: z.enum(CustomerStatus).optional(),
}).refine((data) => Object.keys(data).some((val) => val !== undefined),
  "At least one field must be provided"
);

export const listCustomersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  status: z.enum(CustomerStatus).optional(),
});

export type CreateCustomerInput = z.output<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.output<typeof updateCustomerSchema>;
export type ListCustomersInput = z.output<typeof listCustomersSchema>;
