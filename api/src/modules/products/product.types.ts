import { z } from "zod";
import { ProductStatus } from "@prisma/client";

export const createProductSchema = z.object({
  sku: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(500).nullable().optional(),
  categoryId: z.string().trim().min(1),
  unitPrice: z.number().int().min(0),
  ProductStatus: z.enum(ProductStatus).optional(),
});

export const updateProductSchema = z.object({
  sku: z.string().trim().min(1).max(100).optional(),
  name: z.string().trim().min(1).max(150).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  categoryId: z.string().trim().min(1).optional(),
  unitPrice: z.number().int().min(0).optional(),
  ProductStatus: z.enum(ProductStatus).optional(),
});

export const listProductsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  categoryId: z.string().trim().optional(),
  productStatus: z.enum(ProductStatus).optional(),
});

export type CreateProductInput = z.output<typeof createProductSchema>;
export type UpdateProductInput = z.output<typeof updateProductSchema>;
export type ListProductsInput = z.output<typeof listProductsSchema>;
