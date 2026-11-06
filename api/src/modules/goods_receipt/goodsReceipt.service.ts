import { Prisma, PurchaseOrderStatus, GoodsReceiptStatus } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { GoodsReceiptRepository } from "./goodsReceipt.repository";
import type {
  CreateGoodsReceiptInput,
  UpdateGoodsReceiptInput,
  ListGoodsReceiptsInput,
} from "./goodsReceipt.types";
import ApiError from "../../shared/apiError";
import logger from "../../config/logger";

const handleDBError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new ApiError(409, "Goods receipt already exists");
    }

    if (error.code === "P2003") {
      throw new ApiError(
        409,
        "Invalid purchase order, warehouse, product, or user reference",
      );
    }

    if (error.code === "P2025") {
      throw new ApiError(404, "Goods receipt not found");
    }
  }

  logger.error({ err: error }, "Unexpected goods receipt database error");
  throw error;
};

const handlePostingError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2034") {
      throw new ApiError(
        409,
        "Concurrent inventory update detected. Please retry posting",
      );
    }

    handleDBError(error);
  }

  if (error instanceof Error) {
    if (
      error.message === "Goods receipt not found" ||
      error.message === "Purchase order not found"
    ) {
      throw new ApiError(404, error.message);
    }

    if (
      error.message === "Only draft goods receipts can be posted" ||
      error.message === "Purchase order is not available for receiving goods"
    ) {
      throw new ApiError(409, error.message);
    }

    if (
      error.message ===
      "Purchase order item does not belong to this purchase order"
    ) {
      throw new ApiError(400, error.message);
    }

    if (
      error.message.startsWith(
        "Accepted quantity exceeds remaining quantity",
      )
    ) {
      throw new ApiError(400, error.message);
    }
  }

  logger.error({ err: error }, "Goods receipt posting failed");
  throw error;
};

const generateReceiptNo = () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = randomBytes(3).toString("hex").toUpperCase();

  return `GRN-${date}-${suffix}`;
};

const validatePurchaseOrder = async (
  purchaseOrderId: string,
  items: CreateGoodsReceiptInput["items"],
) => {
  const purchaseOrder =
    await GoodsReceiptRepository.findPurchaseOrder(purchaseOrderId);

  if (!purchaseOrder) {
    throw new ApiError(404, "Purchase order not found");
  }

  const allowedStatuses: PurchaseOrderStatus[] = [
    PurchaseOrderStatus.ORDERED,
    PurchaseOrderStatus.PARTIALLY_RECEIVED,
  ];

  if (!allowedStatuses.includes(purchaseOrder.status)) {
    throw new ApiError(
      409,
      "Goods can only be received against an ordered purchase order",
    );
  }

  for (const item of items) {
    const purchaseOrderItem = purchaseOrder.items.find(
      (poItem) => poItem.id === item.purchaseOrderItemId,
    );

    if (!purchaseOrderItem) {
      throw new ApiError(
        400,
        "Purchase order item does not belong to this purchase order",
      );
    }

    const remainingQuantity =
      purchaseOrderItem.orderedQuantity -
      purchaseOrderItem.receivedQuantity;

    if (item.quantityReceived > remainingQuantity) {
      throw new ApiError(
        400,
        `Received quantity exceeds the remaining quantity for product ${purchaseOrderItem.productId}. Remaining quantity: ${remainingQuantity}`,
      );
    }

    if (
      item.unitCost !== undefined &&
      item.unitCost !== purchaseOrderItem.unitCost
    ) {
      throw new ApiError(
        400,
        "Goods receipt unit cost must match the purchase order item unit cost",
      );
    }
  }

  return purchaseOrder;
};

export const GoodsReceiptService = {
  async create(
    input: CreateGoodsReceiptInput,
    receivedById: string,
  ) {
    await validatePurchaseOrder(input.purchaseOrderId, input.items);

    try {
      const goodsReceipt = await GoodsReceiptRepository.create(
        input,
        generateReceiptNo(),
        receivedById,
      );

      logger.info(
        { goodsReceiptId: goodsReceipt.id },
        "Goods receipt created successfully",
      );

      return goodsReceipt;
    } catch (error) {
      handleDBError(error);
    }
  },

  async list(filters: ListGoodsReceiptsInput) {
    const [total, goodsReceipts] =
      await GoodsReceiptRepository.findAll(filters);

    logger.debug(
      {
        page: filters.page,
        limit: filters.limit,
        resultCount: goodsReceipts.length,
        total,
      },
      "Goods receipts retrieved",
    );

    return {
      items: goodsReceipts,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  },

  async getById(identifier: string) {
    const goodsReceipt =
      await GoodsReceiptRepository.findById(identifier);

    if (!goodsReceipt) {
      throw new ApiError(404, "Goods receipt not found");
    }

    return goodsReceipt;
  },

  async update(
    identifier: string,
    input: UpdateGoodsReceiptInput,
  ) {
    const existingReceipt =
      await GoodsReceiptRepository.findById(identifier);

    if (!existingReceipt) {
      throw new ApiError(404, "Goods receipt not found");
    }

    if (existingReceipt.status !== GoodsReceiptStatus.DRAFT) {
      throw new ApiError(
        409,
        "Only draft goods receipts can be updated",
      );
    }

    if (input.items) {
      await validatePurchaseOrder(
        existingReceipt.purchaseOrderId,
        input.items,
      );
    }

    try {
      const updatedReceipt = await GoodsReceiptRepository.update(
        existingReceipt.id,
        input,
      );

      logger.info(
        {
          goodsReceiptId: updatedReceipt.id,
          updatedFields: Object.keys(input),
        },
        "Goods receipt updated successfully",
      );

      return updatedReceipt;
    } catch (error) {
      handleDBError(error);
    }
  },

  async post(identifier: string) {
    const existingReceipt =
      await GoodsReceiptRepository.findById(identifier);

    if (!existingReceipt) {
      throw new ApiError(404, "Goods receipt not found");
    }

    if (existingReceipt.status !== GoodsReceiptStatus.DRAFT) {
      throw new ApiError(
        409,
        "Only draft goods receipts can be posted",
      );
    }

    try {
      const postedReceipt = await GoodsReceiptRepository.post(
        existingReceipt.id,
      );

      logger.info(
        { goodsReceiptId: postedReceipt.id },
        "Goods receipt posted successfully",
      );

      return postedReceipt;
    } catch (error) {
      handlePostingError(error);
    }
  },

  async cancel(identifier: string) {
    const existingReceipt =
      await GoodsReceiptRepository.findById(identifier);

    if (!existingReceipt) {
      throw new ApiError(404, "Goods receipt not found");
    }

    if (existingReceipt.status !== GoodsReceiptStatus.DRAFT) {
      throw new ApiError(
        409,
        "Only draft goods receipts can be cancelled",
      );
    }

    try {
      const cancelledReceipt =
        await GoodsReceiptRepository.updateStatus(
          existingReceipt.id,
          GoodsReceiptStatus.CANCELLED,
        );

      logger.info(
        { goodsReceiptId: cancelledReceipt.id },
        "Goods receipt cancelled successfully",
      );

      return cancelledReceipt;
    } catch (error) {
      handleDBError(error);
    }
  },
};
