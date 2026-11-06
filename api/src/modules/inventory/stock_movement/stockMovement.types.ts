import { StockMovementType } from "@prisma/client";
import { z } from "zod";

export const listStockMovementSchema = z
  .object({
    productId: z.string().optional(),
    warehouseId: z.string().optional(),

    movementType: z
      .string()
      .optional()
      .transform((value) =>
        value
          ? value.split(",").map((item) => item.trim()).filter(Boolean)
          : undefined,
      )
      .pipe(z.array(z.enum(StockMovementType)).optional()),

    createdFrom: z.coerce.date().optional(),
    createdTo: z.coerce.date().optional(),

    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().optional(),
  })
  .refine(
    (data) =>
      !data.createdFrom ||
      !data.createdTo ||
      data.createdFrom < data.createdTo,
    {
      message: "createdFrom must be earlier than createdTo",
      path: ["createdFrom"],
    },
  );

export type ListStockMovementInput =
  z.output<typeof listStockMovementSchema>;
