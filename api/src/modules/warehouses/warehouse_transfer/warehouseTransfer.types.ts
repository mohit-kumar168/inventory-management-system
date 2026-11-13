import { WarehouseTransferStatus } from "@prisma/client";
import { z } from "zod";

const transferItemSchema = z.object({
  productId: z.string(),
  quantityRequested: z.int().positive().max(10000000),
});

const transferFieldsSchema = z.object({
  sourceWarehouseId: z.string(),
  destinationWarehouseId: z.string(),
  items: z.array(transferItemSchema).min(1).max(100),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const createWarehouseTransferSchema = transferFieldsSchema.refine(
  (data) => data.sourceWarehouseId !== data.destinationWarehouseId,
  {
    message: "Source and destination warehouses must be different",
    path: ["destinationWarehouseId"],
  },
).refine(
  (data) =>
    new Set(data.items.map((item) => item.productId)).size === data.items.length,
  {
    message: "Duplicate products are not allowed",
    path: ["items"],
  },
);

export const updateWarehouseTransferSchema = transferFieldsSchema
  .partial()
  .refine(
    (data) =>
      !data.sourceWarehouseId ||
      !data.destinationWarehouseId ||
      data.sourceWarehouseId !== data.destinationWarehouseId,
    {
      message: "Source and destination warehouses must be different",
      path: ["destinationWarehouseId"],
    },
  )
  .refine(
    (data) =>
      !data.items ||
      new Set(data.items.map((item) => item.productId)).size ===
      data.items.length,
    {
      message: "Duplicate products are not allowed",
      path: ["items"],
    },
  );

export const listWarehouseTransfersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  sourceWarehouseId: z.string().optional(),
  destinationWarehouseId: z.string().optional(),
  status: z.enum(WarehouseTransferStatus).optional(),
  search: z.string().trim().optional(),
});

export const warehouseTransferIdSchema = z.object({
  id: z.string(),
});

const transferQuantitySchema = z.object({
  transferItemId: z.string(),
  quantity: z.int().positive().max(1000000),
});

export const dispatchWarehouseTransferSchema = z.object({
  items: z.array(transferQuantitySchema).min(1).max(100),
});

export const receiveWarehouseTransferSchema = z.object({
  items: z.array(transferQuantitySchema).min(1).max(100),
});

export type CreateWarehouseTransferInput = z.output<typeof createWarehouseTransferSchema>;

export type UpdateWarehouseTransferInput = z.output<typeof updateWarehouseTransferSchema>;

export type ListWarehouseTransfersInput = z.output<typeof listWarehouseTransfersSchema>;

export type DispatchWarehouseTransferInput = z.output<typeof dispatchWarehouseTransferSchema>;

export type ReceiveWarehouseTransferInput = z.output<typeof receiveWarehouseTransferSchema>;
