import { PurchaseOrderStatus } from "@prisma/client";
import { z } from "zod";

const purchaseOrderItemSchema = z.object({
  productId: z
    .string()
    .trim()
    .min(1, "Product ID is required"),

  orderedQuantity: z
    .number()
    .int()
    .min(1, "Ordered quantity must be at least 1")
    .max(1_000_000),

  unitCost: z
    .number()
    .int()
    .min(0, "Unit cost cannot be negative")
    .max(1_000_000_000),

  discountAmount: z
    .number()
    .int()
    .min(0, "Discount cannot be negative")
    .default(0),

}).refine(
  (item) => item.discountAmount <= item.orderedQuantity * item.unitCost,
  {
    message: "Item discount cannot exceed its gross amount",
    path: ["discountAmount"],
  });

export const createPurchaseOrderSchema = z.object({
  supplierId: z
    .string()
    .trim()
    .min(1, "Supplier ID is required"),

  warehouseId: z
    .string()
    .trim()
    .min(1, "Warehouse ID is required"),

  currency: z
    .string()
    .trim()
    .length(3, "Currency must be a 3-letter code")
    .regex(/^[A-Za-z]{3}$/, "Invalid currency code")
    .transform((value) => value.toUpperCase())
    .default("INR"),

  discountAmount: z
    .number()
    .int()
    .min(0, "Discount cannot be negative")
    .default(0),

  shippingAmount: z
    .number()
    .int()
    .min(0, "Shipping amount cannot be negative")
    .default(0),

  expectedAt: z.coerce.date().optional(),

  notes: z
    .string()
    .trim()
    .max(1000, "Notes cannot exceed 1000 characters")
    .optional(),

  items: z
    .array(purchaseOrderItemSchema)
    .min(1, "At least one purchase order item is required")
    .max(100, "A purchase order cannot contain more than 100 items")
    .refine(
      (items) =>
        new Set(items.map((item) => item.productId)).size === items.length,
      "Duplicate products are not allowed in a purchase order",
    ),
}).refine(
  (data) => {
    const subtotal = data.items.reduce(
      (sum, item) =>
        sum + item.orderedQuantity * item.unitCost - item.discountAmount,
      0,
    );

    return data.discountAmount <= subtotal;
  },
  {
    message: "Purchase order discount cannot exceed the subtotal",
    path: ["discountAmount"],
  },
);

export const updatePurchaseOrderSchema = z.object({
  supplierId: z
    .string()
    .trim()
    .min(1, "Supplier ID cannot be empty")
    .optional(),

  warehouseId: z
    .string()
    .trim()
    .min(1, "Warehouse ID cannot be empty")
    .optional(),

  currency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Za-z]{3}$/, "Invalid currency code")
    .transform((value) => value.toUpperCase())
    .optional(),

  discountAmount: z
    .number()
    .int()
    .min(0, "Discount cannot be negative")
    .optional(),

  shippingAmount: z
    .number()
    .int()
    .min(0, "Shipping amount cannot be negative")
    .optional(),

  expectedAt: z.coerce.date().nullable().optional(),

  notes: z
    .string()
    .trim()
    .max(1000, "Notes cannot exceed 1000 characters")
    .nullable()
    .optional(),

  items: z
    .array(purchaseOrderItemSchema)
    .min(1, "At least one item is required")
    .max(100, "A purchase order cannot contain more than 100 items")
    .refine(
      (items) =>
        new Set(items.map((item) => item.productId)).size === items.length,
      "Duplicate products are not allowed",
    )
    .optional(),
}).refine(
  (data) => Object.values(data).some((value) => value !== undefined),
  "At least one field must be provided",
);

export const listPurchaseOrdersSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),

    limit: z.coerce.number().int().min(1).max(100).default(10),

    search: z.string().trim().optional(),

    supplierId: z.string().optional(),

    warehouseId: z.string().optional(),

    status: z.enum(PurchaseOrderStatus).optional(),

    createdFrom: z.coerce.date().optional(),

    createdTo: z.coerce.date().optional(),

    sort: z
      .enum(["createdAt", "-createdAt", "expectedAt", "-expectedAt"])
      .default("-createdAt"),
  })
  .refine(
    (data) =>
      !data.createdFrom ||
      !data.createdTo ||
      data.createdFrom <= data.createdTo,
    {
      message: "createdFrom cannot be later than createdTo",
      path: ["createdTo"],
    },
  );

export const cancelPurchaseOrderSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Cancellation reason is required")
    .max(500, "Cancellation reason cannot exceed 500 characters"),
});

export type CreatePurchaseOrderInput = z.output<typeof createPurchaseOrderSchema>;

export type UpdatePurchaseOrderInput = z.output<typeof updatePurchaseOrderSchema>;

export type ListPurchaseOrdersInput = z.output<typeof listPurchaseOrdersSchema>;

export type CancelPurchaseOrderInput = z.output<typeof cancelPurchaseOrderSchema>;
