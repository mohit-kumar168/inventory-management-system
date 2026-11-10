
import AsyncHandler from "../../shared/asyncHandler";
import ApiResponse from "../../shared/apiResponse";
import ApiError from "../../shared/apiError";
import { ReservationService } from "./reservation.service";
import {
  createReservationSchema,
  listReservationsSchema,
} from "./reservation.types";
import type {
  CreateReservationInput,
  ListReservationsInput,
} from "./reservation.types";

const getReservationId = (id: string | string[] | undefined): string => {
  const reservationId = Array.isArray(id) ? id[0] : id;

  if (!reservationId) {
    throw new ApiError(400, "Reservation ID is required");
  }

  return reservationId;
};

export const createReservationController = AsyncHandler(
  async (req, res) => {
    const parsed = createReservationSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message || "Invalid reservation data",
      );
    }

    const reservation = await ReservationService.create(
      parsed.data as CreateReservationInput,
    );

    res
      .status(201)
      .json(
        new ApiResponse(
          "Reservation created successfully",
          reservation,
        ),
      );
  },
);

export const listReservationsController = AsyncHandler(
  async (req, res) => {
    const parsed = listReservationsSchema.safeParse(req.query);

    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message || "Invalid reservation query parameters",
      );
    }

    const reservations = await ReservationService.list(
      parsed.data as ListReservationsInput,
    );

    res
      .status(200)
      .json(
        new ApiResponse(
          "Reservations retrieved successfully",
          reservations,
        ),
      );
  },
);

export const getReservationController = AsyncHandler(
  async (req, res) => {
    const id = getReservationId(req.params.id);

    const reservation = await ReservationService.getById(id);

    res
      .status(200)
      .json(
        new ApiResponse(
          "Reservation retrieved successfully",
          reservation,
        ),
      );
  },
);

export const getExpiredReservationsController = AsyncHandler(
  async (_req, res) => {
    const reservations = await ReservationService.getExpired();

    res
      .status(200)
      .json(
        new ApiResponse(
          "Expired reservations retrieved successfully",
          reservations,
        ),
      );
  },
);

