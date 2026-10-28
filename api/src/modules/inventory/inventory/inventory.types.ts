import { z } from "zod";

export const listInventoryBalancesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  productId: z.string().optional(),
  warehouseId: z.string().optional(),
  categoryId: z.string().optional(),
  minAvailable: z.coerce.number().int().min(0).optional(),
  maxAvailable: z.coerce.number().int().min(0).optional(),
  nonZeroOnly: z.enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  sort: z.enum(["sku", "-sku", "onHandQuantity", "-onHandQuantity", "reserveQuantity", "-reserveQuantity", "availableQuantity", "-availableQuantity"])
    .default("-sku"),
}).refine(
  (data) =>
    data.minAvailable === undefined ||
    data.maxAvailable === undefined ||
    data.minAvailable <= data.maxAvailable,
  {
    message: "minAvailable cannot exceed maxAvailable",
    path: ["maxAvailable"],
  },
);

export const reconciliationSchema = z.object({
  productId: z.string().optional(),
  warehouseId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(200),
});

export type ListInventoryBalancesInput = z.output<typeof listInventoryBalancesSchema>
export type ReconciliationInput = z.output<typeof reconciliationSchema>
