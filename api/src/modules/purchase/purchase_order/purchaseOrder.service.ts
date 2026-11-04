import { Prisma, PurchaseOrderStatus } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { PurchaseOrderRepository } from "./purchaseOrder.repository";
import type {
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
  ListPurchaseOrdersInput,
} from "./purchaseOrder.types";
import ApiError from "../../../shared/apiError";
import logger from "../../../config/logger";

const handleDBError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new ApiError(409, "Purchase order already exists");
    }

    if (error.code === "P2003") {
      throw new ApiError(409, "Invalid supplier, warehouse, product, or user reference")
    }

    if (error.code === "P2025") {
      throw new ApiError(404, "Purchase order not found");
    }
  }

  logger.error({ err: error }, "Unexpected purchase order database error");
  throw error;
}

const generatePurchaseOrderNo = () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `PO-${date}-${suffix}`;
}

export const PurchaseOrderService = {
  async create(
    input: CreatePurchaseOrderInput,
    createdById: string,
    idempotencyKey?: string,
  ) {
    if (idempotencyKey) {
      const existingOrder = await PurchaseOrderRepository.findByIdempotencyKey(idempotencyKey);

      if (existingOrder) {
        return existingOrder;
      }
    }


    const purchaseOrderNo = generatePurchaseOrderNo();

    try {
      const purchaseOrder = await PurchaseOrderRepository.create(
        input,
        createdById,
        purchaseOrderNo,
        idempotencyKey,
      );

      logger.info(
        { purchaseOrderId: purchaseOrder.id },
        "Purchae order created successfully",
      );

      return purchaseOrder;
    } catch (error) {
      if (
        idempotencyKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existingOrder = await PurchaseOrderRepository.findByIdempotencyKey(idempotencyKey);

        if (existingOrder) {
          return existingOrder;
        }
      }
      handleDBError(error);
    }
  },

  async list(filters: ListPurchaseOrdersInput) {
    const [total, purchaseOrders] = await PurchaseOrderRepository.findAll(filters);
    logger.debug(
      {
        page: filters.page,
        limit: filters.limit,
        resultCount: purchaseOrders.length,
        total,
      },
      "Purchase Order retrieved",
    );

    return {
      items: purchaseOrders,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  },

  async getById(id: string) {
    const purchaseOrder = await PurchaseOrderRepository.findById(id);

    if (!purchaseOrder) {
      logger.warn({ purchaseOrderId: id }, "Purchase order lookup failed");
      throw new ApiError(404, "Purchase order not found");
    }
    return purchaseOrder;
  },

  async update(id: string, input: UpdatePurchaseOrderInput) {
    const existingOrder = await PurchaseOrderRepository.findById(id);

    if (!existingOrder) {
      logger.warn({ purchaseOrderId: id }, "Purchase order not found");
      throw new ApiError(404, "Purchase Order not found");
    }

    if (existingOrder.status !== PurchaseOrderStatus.DRAFT) {
      throw new ApiError(
        409,
        "Only draft purchase orders can be updated",
      );
    }


    const items = input.items ?? existingOrder.items;

    const subtotal = items.reduce(
      (sum, item) =>
        sum + item.orderedQuantity * item.unitCost - item.discountAmount,
      0,
    );

    const discountAmount = input.discountAmount ?? existingOrder.discountAmount;

    if (discountAmount > subtotal) {
      throw new ApiError(400, "Purchase order discount cannot exceed subtotal");
    }
    try {
      const purchaseOrder = await PurchaseOrderRepository.update(id, input);
      logger.info(
        {
          purchaseOrderId: purchaseOrder.id,
          updatedFields: Object.keys(input)
        },
        "Purchase Order updated successfully"
      );
      return purchaseOrder;
    } catch (error) {
      handleDBError(error);
    }
  },

  async submit(id: string) {
    const purchaseOrder = await PurchaseOrderRepository.findById(id);
    if (!purchaseOrder) {
      logger.warn({ purchaseOrderId: id }, "Purchase order not found");
      throw new ApiError(404, "Purchase order not found");
    }

    if (purchaseOrder.status !== PurchaseOrderStatus.DRAFT) {
      throw new ApiError(409, "Only draft purchase orders can be submitted");
    }

    try {
      const updatedOrder = await PurchaseOrderRepository.updateStatus(id, PurchaseOrderStatus.PENDING_APPROVAL);

      logger.info(
        { purchaseOrderId: id },
        "Purchase order submitted for approval",
      );

      return updatedOrder;
    } catch (error) {
      handleDBError(error);
    }
  },

  async cancel(id: string) {
    const purchaseOrder = await PurchaseOrderRepository.findById(id);

    if (!purchaseOrder) {
      throw new ApiError(404, "Purchase order not found");
    }

    const cancellableStatus: PurchaseOrderStatus[] = [
      PurchaseOrderStatus.DRAFT,
      PurchaseOrderStatus.PENDING_APPROVAL,
      PurchaseOrderStatus.APPROVED,
      PurchaseOrderStatus.ORDERED,
    ];

    if (!cancellableStatus.includes(purchaseOrder.status)) {
      throw new ApiError(409, "This purchase order cannot be cancelled");
    }

    try {
      const updatedOrder = await PurchaseOrderRepository.updateStatus(id, PurchaseOrderStatus.CANCELLED);

      logger.info(
        { purchaseOrderId: id },
        "Purchase order cancelled successfully",
      );

      return updatedOrder;
    } catch (error) {
      handleDBError(error);
    }
  }
};
