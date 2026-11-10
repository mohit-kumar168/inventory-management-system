
import { Prisma, SalesOrderStatus } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { SalesOrderRepository } from "./salesOrder.repository";
import type {
  CreateSalesOrderInput,
  UpdateSalesOrderInput,
  ListSalesOrdersInput,
} from "./salesOrder.types";
import ApiError from "../../shared/apiError";
import logger from "../../config/logger";

const handleDBError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new ApiError(409, "Sales order already exists");
    }

    if (error.code === "P2003") {
      throw new ApiError(
        409,
        "Invalid customer, address, product, or user reference",
      );
    }

    if (error.code === "P2025") {
      throw new ApiError(404, "Sales order not found");
    }

    if (error.code === "P2034") {
      throw new ApiError(
        409,
        "Sales order operation conflicted with another transaction. Please retry",
      );
    }
  }

  logger.error({ err: error }, "Unexpected sales order database error");
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
  },

  async getById(id: string) {
    const salesOrder = await SalesOrderRepository.findById(id);

    if (!salesOrder) {
      logger.warn({ salesOrderId: id }, "Sales order lookup failed");
      throw new ApiError(404, "Sales order not found");
    }

    return salesOrder;
  },

  async update(id: string, input: UpdateSalesOrderInput) {
    const existingOrder = await SalesOrderRepository.findById(id);

    if (!existingOrder) {
      logger.warn({ salesOrderId: id }, "Sales order not found");
      throw new ApiError(404, "Sales order not found");
    }

    if (existingOrder.status !== SalesOrderStatus.DRAFT) {
      throw new ApiError(
        409,
        "Only draft sales orders can be updated",
      );
    }

    try {
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
      handleDBError(error);
    }
  },
};

