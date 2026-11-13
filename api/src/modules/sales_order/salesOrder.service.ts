import {
  Prisma,
  SalesOrderStatus,
} from "@prisma/client";
import { randomBytes } from "node:crypto";
import SalesOrderRepository from "./salesOrder.repository";
import type {
  CreateSalesOrderInput,
  UpdateSalesOrderInput,
  ListSalesOrdersInput,
} from "./salesOrder.types";
import ApiError from "../../shared/apiError";
import logger from "../../config/logger";

const handleDBError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002":
        throw new ApiError(409, "Sales order already exists");

      case "P2003":
        throw new ApiError(
          409,
          "Invalid customer, address, product, or user reference",
        );

      case "P2025":
        throw new ApiError(404, "Sales order not found");

      case "P2034":
        throw new ApiError(
          409,
          "Transaction conflict. Please retry the operation",
        );
    }
  }

  logger.error(
    { err: error },
    "Unexpected sales order database error",
  );

  throw error;
};

const generateSalesOrderNo = () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = randomBytes(3).toString("hex").toUpperCase();

  return `SO-${date}-${suffix}`;
};

export const SalesOrderService = {
  async create(
    input: CreateSalesOrderInput,
    createdById: string,
    idempotencyKey: string,
  ) {
    const existingOrder =
      await SalesOrderRepository.findByIdempotencyKey(idempotencyKey);

    if (existingOrder) {
      return existingOrder;
    }

    const salesOrderNo = generateSalesOrderNo();

    try {
      const salesOrder = await SalesOrderRepository.create(
        input,
        createdById,
        salesOrderNo,
        idempotencyKey,
      );

      logger.info(
        { salesOrderId: salesOrder.id },
        "Sales order created successfully",
      );

      return salesOrder;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existingOrder =
          await SalesOrderRepository.findByIdempotencyKey(idempotencyKey);

        if (existingOrder) {
          return existingOrder;
        }
      }

      handleDBError(error);
    }
  },

  async list(filters: ListSalesOrdersInput) {
    try {
      const [total, salesOrders] =
        await SalesOrderRepository.findAll(filters);

      logger.debug(
        {
          page: filters.page,
          limit: filters.limit,
          resultCount: salesOrders.length,
          total,
        },
        "Sales orders retrieved",
      );

      return {
        items: salesOrders,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total,
          totalPages: Math.ceil(total / filters.limit),
        },
      };
    } catch (error) {
      handleDBError(error);
    }
  },

  async getById(id: string) {
    try {
      const salesOrder = await SalesOrderRepository.findById(id);

      if (!salesOrder) {
        throw new ApiError(404, "Sales order not found");
      }

      return salesOrder;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      handleDBError(error);
    }
  },

  async update(id: string, input: UpdateSalesOrderInput) {
    try {
      const existingOrder = await SalesOrderRepository.findById(id);

      if (!existingOrder) {
        throw new ApiError(404, "Sales order not found");
      }

      if (existingOrder.status !== SalesOrderStatus.DRAFT) {
        throw new ApiError(
          409,
          "Only draft sales orders can be updated",
        );
      }

      const salesOrder = await SalesOrderRepository.update(id, input);

      logger.info(
        {
          salesOrderId: salesOrder.id,
          updatedFields: Object.keys(input),
        },
        "Sales order updated successfully",
      );

      return salesOrder;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      handleDBError(error);
    }
  },

  async confirm(id: string, warehouseId: string) {
    if (!warehouseId?.trim()) {
      throw new ApiError(400, "Warehouse ID is required");
    }

    try {
      const salesOrder = await SalesOrderRepository.confirm(
        id,
        warehouseId,
      );

      logger.info(
        { salesOrderId: id, warehouseId },
        "Sales order confirmed successfully",
      );

      return salesOrder;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      handleDBError(error);
    }
  },

  async cancel(id: string, reason: string) {
    if (!reason?.trim()) {
      throw new ApiError(400, "Cancellation reason is required");
    }

    try {
      const salesOrder = await SalesOrderRepository.cancel(
        id,
        reason,
      );

      logger.info(
        { salesOrderId: id },
        "Sales order cancelled successfully",
      );

      return salesOrder;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      handleDBError(error);
    }
  },
};

