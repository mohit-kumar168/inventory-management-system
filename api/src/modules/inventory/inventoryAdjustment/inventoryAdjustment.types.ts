import { InventoryAdjustmentStatus } from "@prisma/client";
import { z } from "zod";

export const createInventoryAdjustmentSchema = z.object({
  warehouseId: z.string().min(1),
  status: z.enum(InventoryAdjustmentStatus),
  reason: z.string().trim().max(1000),
  notes: z.string().trim().max(1000).optional(),
  items: z.array(
    z.object({
      productId: z.string().min(1),
      quantityDelta: z.number().int().min(-1_000_000).max(1_000_000).refine(
        (value) => value !== 0,
        "quantityDelta cannot be zero",
      ),
    }),
  )
    .min(1)
    .max(100)
    .refine(
      (items) => new Set(items.map((item) => item.productId)).size === items.length,
      "Each productId must be unique within an adjustment"
    ),
});

export const listInventoryAdjustmentsSchema = z.object({
  warehouseId: z.string().optional(),
  InventoryAdjustmentStatus: z.string().optional(),
  status: z.enum(InventoryAdjustmentStatus).optional(),
  createdById: z.string().optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
  sort: z.enum(["createdAt", "-createdAt"]).default("-createdAt"),
  page: z.coerce.number().int().min(1).max(100).default(20),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const rejectInventoryAdjustmentSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export type CreateInventoryAdjustmentInput = z.output<typeof createInventoryAdjustmentSchema>;
export type ListInventoryAdjustmentsInput = z.output<typeof listInventoryAdjustmentsSchema>;
export type RejectInventoryAdjustmentInput = z.output<typeof rejectInventoryAdjustmentSchema>;

