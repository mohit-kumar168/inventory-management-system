
import { Prisma } from "@prisma/client";
import { ReservationRepository } from "./reservation.repository";
import type {
  CreateReservationInput,
  ListReservationsInput,
} from "./reservation.types";
import ApiError from "../../shared/apiError";
import logger from "../../config/logger";

const handleDBError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new ApiError(409, "Reservation already exists");
    }

    if (error.code === "P2003") {
      throw new ApiError(
        409,
        "Invalid sales order item, product, or warehouse reference",
      );
    }

    if (error.code === "P2025") {
      throw new ApiError(404, "Reservation not found");
    }

    if (error.code === "P2034") {
      throw new ApiError(
        409,
        "Concurrent inventory update detected. Please retry",
      );
    }
  }

  if (error instanceof Error) {
    const businessErrors: Record<string, [number, string]> = {
      "Sales order item not found": [
        404,
        "Sales order item not found",
      ],
      "Reservations require a confirmed sales order": [
        409,
        "Reservations require a confirmed sales order",
      ],
      "Product is not active": [
        409,
        "Product is not active",
      ],
      "Warehouse not found": [
        404,
        "Warehouse not found",
      ],
      "Warehouse is not active": [
        409,
        "Warehouse is not active",
      ],
      "Inventory balance not found": [
        409,
        "Inventory balance not found",
      ],
      "Reservation quantity exceeds remaining order quantity": [
        400,
        "Reservation quantity exceeds remaining order quantity",
      ],
      "Insufficient available inventory": [
        409,
        "Insufficient available inventory",
      ],
    };

    const businessError = businessErrors[error.message];

    if (businessError) {
      throw new ApiError(businessError[0], businessError[1]);
    }
  }

  logger.error(
    { err: error },
    "Unexpected reservation database error",
  );

  throw error;
};

export const ReservationService = {
  async create(input: CreateReservationInput) {
    try {
      const reservation = await ReservationRepository.create(input);

      logger.info(
        {
          reservationId: reservation.id,
          salesOrderItemId: reservation.salesOrderItemId,
          productId: reservation.productId,
          warehouseId: reservation.warehouseId,
          quantity: reservation.quantity,
        },
        "Reservation created successfully",
      );

      return reservation;
    } catch (error) {
      handleDBError(error);
    }
  },

  async list(filters: ListReservationsInput) {
    const result = await ReservationRepository.findAll(filters);

    logger.debug(
      {
        page: filters.page,
        limit: filters.limit,
        resultCount: result.reservations.length,
        total: result.pagination.total,
      },
      "Reservations retrieved",
    );

    return {
      items: result.reservations,
      pagination: result.pagination,
    };
  },

  async getById(id: string) {
    const reservation = await ReservationRepository.findById(id);

    if (!reservation) {
      throw new ApiError(404, "Reservation not found");
    }

    return reservation;
  },

  async getExpired() {
    const reservations = await ReservationRepository.findExpired();

    logger.debug(
      {
        resultCount: reservations.length,
      },
      "Expired reservations retrieved",
    );

    return reservations;
  },
};

