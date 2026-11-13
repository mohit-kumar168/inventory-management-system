import { Prisma, WarehouseTransferStatus } from "@prisma/client";
import { randomBytes } from "node:crypto";
import WarehouseTransferRepository from "./warehouseTransfer.repository";
import type {
  CreateWarehouseTransferInput,
  UpdateWarehouseTransferInput,
  ListWarehouseTransfersInput,
  DispatchWarehouseTransferInput,
  ReceiveWarehouseTransferInput,
} from "./warehouseTransfer.types";
import ApiError from "../../../shared/apiError";
import logger from "../../../config/logger";

const handleDBError = (error: unknown): never => {
  if (error instanceof ApiError) {
    throw error;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002":
        logger.warn(
          { code: error.code },
          "Warehouse transfer operation rejected: duplicate record",
        );
        throw new ApiError(409, "Warehouse transfer already exists.");

      case "P2003":
        logger.warn(
          { code: error.code },
          "Warehouse transfer operation rejected: invalid related record",
        );
        throw new ApiError(
          409,
          "Invalid warehouse, product, or user reference.",
        );

      case "P2025":
        throw new ApiError(404, "Warehouse transfer not found.");

      case "P2034":
        logger.warn(
          { code: error.code },
          "Warehouse transfer transaction conflict",
        );
        throw new ApiError(
          409,
          "Transaction conflict. Please retry the request.",
        );
    }
  }

  logger.error(
    { err: error },
    "Unexpected warehouse transfer database error",
  );

  throw error;
};

const generateTransferNo = (): string => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = randomBytes(3).toString("hex").toUpperCase();

  return `TRF-${date}-${suffix}`;
};

const WarehouseTransferService = {
  async create(
    input: CreateWarehouseTransferInput,
    createdById: string,
    idempotencyKey: string,
  ) {
    try {
      const existingTransfer =
        await WarehouseTransferRepository.findByIdempotencyKey(
          idempotencyKey,
        );

      if (existingTransfer) {
        return existingTransfer;
      }

      const transfer = await WarehouseTransferRepository.create(
        input,
        createdById,
        generateTransferNo(),
        idempotencyKey,
      );

      logger.info(
        {
          transferId: transfer.id,
          transferNo: transfer.transferNo,
          createdById,
        },
        "Warehouse transfer created successfully",
      );

      return transfer;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existingTransfer =
          await WarehouseTransferRepository.findByIdempotencyKey(
            idempotencyKey,
          );

        if (existingTransfer) {
          return existingTransfer;
        }
      }

      handleDBError(error);
    }
  },

  async list(filters: ListWarehouseTransfersInput) {
    try {
      const result = await WarehouseTransferRepository.findAll(filters);

      logger.debug(
        {
          page: filters.page,
          limit: filters.limit,
          resultCount: result.items.length,
          totalItems: result.meta.totalItems,
        },
        "Warehouse transfers retrieved",
      );

      return {
        items: result.items,
        pagination: result.meta,
      };
    } catch (error) {
      handleDBError(error);
    }
  },

  async getById(id: string) {
    try {
      const transfer = await WarehouseTransferRepository.findById(id);

      if (!transfer) {
        logger.warn(
          { transferId: id },
          "Warehouse transfer lookup failed",
        );
        throw new ApiError(404, "Warehouse transfer not found.");
      }

      return transfer;
    } catch (error) {
      handleDBError(error);
    }
  },

  async update(id: string, input: UpdateWarehouseTransferInput) {
    try {
      const existingTransfer =
        await WarehouseTransferRepository.findById(id);

      if (!existingTransfer) {
        throw new ApiError(404, "Warehouse transfer not found.");
      }

      if (existingTransfer.status !== WarehouseTransferStatus.DRAFT) {
        throw new ApiError(
          409,
          "Only draft warehouse transfers can be updated.",
        );
      }

      const transfer = await WarehouseTransferRepository.update(id, input);

      logger.info(
        {
          transferId: id,
          updatedFields: Object.keys(input),
        },
        "Warehouse transfer updated successfully",
      );

      return transfer;
    } catch (error) {
      handleDBError(error);
    }
  },

  async submitForApproval(id: string) {
    try {
      const existingTransfer =
        await WarehouseTransferRepository.findById(id);

      if (!existingTransfer) {
        throw new ApiError(404, "Warehouse transfer not found.");
      }

      if (existingTransfer.status !== WarehouseTransferStatus.DRAFT) {
        throw new ApiError(
          409,
          "Only draft warehouse transfers can be submitted for approval.",
        );
      }

      const result =
        await WarehouseTransferRepository.submitForApproval(id);

      if (result.count !== 1) {
        throw new ApiError(
          409,
          "Warehouse transfer status changed. Please try again.",
        );
      }

      const transfer = await WarehouseTransferRepository.findById(id);

      logger.info(
        { transferId: id },
        "Warehouse transfer submitted for approval",
      );

      return transfer;
    } catch (error) {
      handleDBError(error);
    }
  },

  async approve(id: string) {
    try {
      const existingTransfer =
        await WarehouseTransferRepository.findById(id);

      if (!existingTransfer) {
        throw new ApiError(404, "Warehouse transfer not found.");
      }

      if (
        existingTransfer.status !==
        WarehouseTransferStatus.PENDING_APPROVAL
      ) {
        throw new ApiError(
          409,
          "Only pending warehouse transfers can be approved.",
        );
      }

      const result = await WarehouseTransferRepository.approve(id);

      if (result.count !== 1) {
        throw new ApiError(
          409,
          "Warehouse transfer status changed. Please try again.",
        );
      }

      const transfer = await WarehouseTransferRepository.findById(id);

      logger.info(
        { transferId: id },
        "Warehouse transfer approved successfully",
      );

      return transfer;
    } catch (error) {
      handleDBError(error);
    }
  },

  async dispatch(
    id: string,
    input: DispatchWarehouseTransferInput,
    createdById: string,
  ) {
    try {
      const existingTransfer =
        await WarehouseTransferRepository.findById(id);

      if (!existingTransfer) {
        throw new ApiError(404, "Warehouse transfer not found.");
      }

      if (existingTransfer.status !== WarehouseTransferStatus.APPROVED) {
        throw new ApiError(
          409,
          "Only approved warehouse transfers can be dispatched.",
        );
      }

      const transfer = await WarehouseTransferRepository.dispatch(
        id,
        input,
        createdById,
      );

      logger.info(
        {
          transferId: id,
          createdById,
        },
        "Warehouse transfer dispatched successfully",
      );

      return transfer;
    } catch (error) {
      handleDBError(error);
    }
  },

  async receive(
    id: string,
    input: ReceiveWarehouseTransferInput,
    createdById: string,
  ) {
    try {
      const existingTransfer =
        await WarehouseTransferRepository.findById(id);

      if (!existingTransfer) {
        throw new ApiError(404, "Warehouse transfer not found.");
      }

      if (
        existingTransfer.status !== WarehouseTransferStatus.DISPATCHED &&
        existingTransfer.status !==
        WarehouseTransferStatus.PARTIALLY_RECEIVED
      ) {
        throw new ApiError(
          409,
          "Only dispatched warehouse transfers can be received.",
        );
      }

      const transfer = await WarehouseTransferRepository.receive(
        id,
        input,
        createdById,
      );

      logger.info(
        {
          transferId: id,
          createdById,
        },
        "Warehouse transfer receipt recorded successfully",
      );

      return transfer;
    } catch (error) {
      handleDBError(error);
    }
  },

  async cancel(id: string) {
    try {
      const existingTransfer =
        await WarehouseTransferRepository.findById(id);

      if (!existingTransfer) {
        throw new ApiError(404, "Warehouse transfer not found.");
      }

      if (existingTransfer.status !== WarehouseTransferStatus.DRAFT) {
        throw new ApiError(
          409,
          "Only draft warehouse transfers can be cancelled.",
        );
      }

      const result = await WarehouseTransferRepository.cancel(id);

      if (result.count !== 1) {
        throw new ApiError(
          409,
          "Warehouse transfer status changed. Please try again.",
        );
      }

      const transfer = await WarehouseTransferRepository.findById(id);

      logger.info(
        { transferId: id },
        "Warehouse transfer cancelled successfully",
      );

      return transfer;
    } catch (error) {
      handleDBError(error);
    }
  },
};

export default WarehouseTransferService;

