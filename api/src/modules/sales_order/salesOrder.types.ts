
import {
  SalesOrderStatus,
  PaymentStatus,
  FulfillmentStatus,
} from "@prisma/client";
import { z } from "zod";

const shippingAddressSchema = z.object({
  recipientName: z.string().trim().min(1).max(150),
  phone: z.string().trim().max(20).optional(),
  addressLine1: z.string().trim().min(1).max(255),
  addressLine2: z.string().trim().max(255).optional(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().min(1).max(20),
  country: z.string().trim().min(1).max(100),
});

const salesOrderItemSchema = z.object({
  productId: z.string(),
  quantity: z.int().min(1).max(1000000),
  discountAmount: z.int().nonnegative().default(0),
});

const salesOrderFieldsSchema = z.object({
  customerId: z.string().optional(),
  shippingAddressId: z.string().optional(),
  shippingAddress: shippingAddressSchema.optional(),
  items: z.array(salesOrderItemSchema).min(1).max(100).optional(),
  discountAmount: z.int().nonnegative().optional(),
  shippingAmount: z.int().nonnegative().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const createSalesOrderSchema = salesOrderFieldsSchema
  .extend({
    customerId: z.string(),
    items: z.array(salesOrderItemSchema).min(1).max(100),
  })
  .refine(
    (data) =>
      Number(Boolean(data.shippingAddressId)) +
      Number(Boolean(data.shippingAddress)) === 1,
    {
      message:
        "Provide exactly one of shippingAddressId or shippingAddress",
      path: ["shippingAddressId"],
    },
  )
  .refine(
    (data) =>
      new Set(data.items.map((item) => item.productId)).size ===
      data.items.length,
    {
      message: "Duplicate products are not allowed",
      path: ["items"],
    },
  );

export const updateSalesOrderSchema = salesOrderFieldsSchema
  .partial()
  .refine(
    (data) =>
      data.shippingAddressId === undefined ||
      data.shippingAddress === undefined,
    {
      message:
        "Provide either shippingAddressId or shippingAddress, not both",
      path: ["shippingAddressId"],
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

export const listSalesOrdersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  customerId: z.string().optional(),
  status: z.enum(SalesOrderStatus).optional(),
  paymentStatus: z.enum(PaymentStatus).optional(),
  fulfillmentStatus: z.enum(FulfillmentStatus).optional(),
  search: z.string().trim().optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
});

export const salesOrderIdSchema = z.object({
  id: z.string(),
});

export const confirmSalesOrderSchema = z.object({
  warehouseId: z.string().trim().min(1),
});

export const cancelSalesOrderSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export type CreateSalesOrderInput = z.output<typeof createSalesOrderSchema>;

export type UpdateSalesOrderInput = z.output<typeof updateSalesOrderSchema>;

export type ListSalesOrdersInput = z.output<typeof listSalesOrdersSchema>;

export type ConfirmSalesOrderInput = z.output<
  typeof confirmSalesOrderSchema
>;

export type CancelSalesOrderInput = z.output<
  typeof cancelSalesOrderSchema
>;

