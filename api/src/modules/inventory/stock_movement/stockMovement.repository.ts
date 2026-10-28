import { Prisma } from "@prisma/client";
import prisma from "../../../prisma/db";
import type {
  ListStockMovementInput
} from "../stock_movement/stockMovement.types";

const movementListSelect = {
  id: true,
  productId: true,
  warehouseId: true,
  movementType: true,
  quantityDelta: true,
  createdAt: true,
  createdById: true,
  goodsReceiptItemId: true,
  shipmentItemId: true,
  transferItemId: true,
  adjustmentItemId: true,
  returnItemId: true,
};

const movementDetailInclude = {
  product: {
    select: {
      id: true,
      sku: true,
      name: true,
    },
  },
  warehouse: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  goodsReceiptItem: {
    select: {
      id: true,
      goodsReceipt: {
        select: {
          id: true,
          receiptNo: true,
        },
      },
    },
  },
  shipmentItem: {
    select: {
      id: true,
      shipment: {
        select: {
          id: true,
          shipmentNo: true,
        },
      },
    },
  },
  transferItem: {
    select: {
      id: true,
      transfer: {
        select: {
          id: true,
          transferNo: true,
        },
      },
    },
  },
  adjustmentItem: {
    select: {
      id: true,
      adjustment: {
        select: {
          id: true,
          adjustmentNo: true,
        },
      },
    },
  },
  returnItem: {
    select: {
      id: true,
      return: {
        select: {
          id: true,
          returnNo: true,
        },
      },
    },
  },
};

export const stockMovementRepository = {
  async findMany(filters: ListStockMovementInput) {
    const where: Prisma.StockMovementWhereInput = {};

    if (filters.productId) {
      where.productId = filters.productId;
    }

    if (filters.warehouseId) {
      where.warehouseId = filters.warehouseId;
    }

    if (filters.movementType?.length) {
      where.movementType = {
        in: filters.movementType,
      };
    }

    if (filters.createdFrom || filters.createdTo) {
      where.createdAt = {
        ...(filters.createdFrom
          ? { gte: filters.createdFrom }
          : {}),
        ...(filters.createdTo
          ? { lt: filters.createdTo }
          : {}),
      };
    }
    const movements = await prisma.stockMovement.findMany({
      where,
      select: movementListSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: filters.limit + 1,
      ...(filters.cursor
        ? {
          cursor: { id: filters.cursor },
          skip: 1,
        }
        : {}),
    });

    const hasMore = movements.length > filters.limit;
    const items = hasMore ? movements.slice(0, filters.limit) : movements;

    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
      hasMore,
    };
  },

  async findById(movementId: string) {
    return prisma.stockMovement.findUnique({
      where: { id: movementId },
      include: movementDetailInclude,
    });
  },
};
