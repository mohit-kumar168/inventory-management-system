import { GoodsReceiptStatus } from "@prisma/client";
import { z } from "zod";

const goodsReceiptItemSchema = z.object({
  purchaseOrderItemId: z
    .string()
    .trim()
    .min(1, "Purchase order item ID is required"),

  quantityReceived: z
    .number()
    .int()
    .min(1, "Received quantity must be at least 1")
    .max(1_000_000),

  quantityAccepted: z
    .number()
    .int()
    .min(0, "Accepted quantity cannot be negative")
    .max(1_000_000),

  quantityRejected: z
    .number()
    .int()
    .min(0, "Rejected quantity cannot be negative")
    .max(1_000_000)
    .default(0),

  unitCost: z
    .number()
    .int()
    .min(0, "Unit cost cannot be negative")
    .max(1_000_000_000)
    .optional(),
}).refine(
  (item) =>
    item.quantityAccepted + item.quantityRejected ===
    item.quantityReceived,
  {
    message: "Accepted and rejected quantities must equal received quantity",
    path: ["quantityAccepted"],
  },
);

export const createGoodsReceiptSchema = z.object({
  purchaseOrderId: z
    .string()
    .trim()
    .min(1, "Purchase order ID is required"),

  notes: z
    .string()
    .trim()
    .max(1000, "Notes cannot exceed 1000 characters")
    .optional(),

  receivedAt: z.coerce.date().optional(),

  items: z
    .array(goodsReceiptItemSchema)
    .min(1, "At least one goods receipt item is required")
    .max(100, "A goods receipt cannot contain more than 100 items")
    .refine(
      (items) =>
        new Set(items.map((item) => item.purchaseOrderItemId)).size ===
        items.length,
      "Duplicate purchase order items are not allowed",
    ),
});

export const updateGoodsReceiptSchema = z.object({
  notes: z
    .string()
    .trim()
    .max(1000, "Notes cannot exceed 1000 characters")
    .nullable()
    .optional(),

  receivedAt: z.coerce.date().optional(),

  items: z
    .array(goodsReceiptItemSchema)
    .min(1, "At least one goods receipt item is required")
    .max(100, "A goods receipt cannot contain more than 100 items")
    .refine(
      (items) =>
        new Set(items.map((item) => item.purchaseOrderItemId)).size ===
        items.length,
      "Duplicate purchase order items are not allowed",
    )
    .optional(),
}).refine(
  (data) => Object.values(data).some((value) => value !== undefined),
  "At least one field must be provided",
);

export const listGoodsReceiptsSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),

    limit: z.coerce.number().int().min(1).max(100).default(10),

    search: z.string().trim().optional(),

    purchaseOrderId: z.string().optional(),

    warehouseId: z.string().optional(),

    status: z.enum(GoodsReceiptStatus).optional(),

    receivedFrom: z.coerce.date().optional(),

    receivedTo: z.coerce.date().optional(),

    sort: z
      .enum([
        "receivedAt",
        "-receivedAt",
        "createdAt",
        "-createdAt",
      ])
      .default("-receivedAt"),
  })
  .refine(
    (data) =>
      !data.receivedFrom ||
      !data.receivedTo ||
      data.receivedFrom <= data.receivedTo,
    {
      message: "receivedFrom cannot be later than receivedTo",
      path: ["receivedTo"],
    },
  );

export type CreateGoodsReceiptInput = z.output<
  typeof createGoodsReceiptSchema
>;

export type UpdateGoodsReceiptInput = z.output<
  typeof updateGoodsReceiptSchema
>;

export type ListGoodsReceiptsInput = z.output<
  typeof listGoodsReceiptsSchema
>;
