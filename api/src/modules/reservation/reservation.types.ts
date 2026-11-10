import { ReservationStatus } from "@prisma/client";
import { z } from "zod";

export const createReservationSchema = z.object({
  salesOrderItemId: z.string(),
  warehouseId: z.string(),
  quantity: z.int().positive(),
  expiresAt: z.coerce.date().optional(),
});

export const listReservationsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().default(1),
  search: z.string().trim().optional(),
  salesOrderItemId: z.string().optional(),
  productId: z.string().optional(),
  warehouseId: z.string().optional(),
  status: z.enum(ReservationStatus).optional(),
});

export const reservationIdSchema = z.object({
  id: z.string(),
});

export type CreateReservationInput = z.output<typeof createReservationSchema>;
export type ListReservationsInput = z.output<typeof listReservationsSchema>;
