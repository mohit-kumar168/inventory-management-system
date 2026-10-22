import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  parentId: z.string().min(1).nullable().optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1).optional(),
  slug: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  parentId: z.string().trim().min(1).nullable().optional(),
}).refine(
  (data) => Object.keys(data).length > 0, {
  message: "At least one field must be provided",
});

export type CreateCategoryInput = z.output<typeof createCategorySchema>;
export type UpdateCategoryInput = z.output<typeof updateCategorySchema>;
