import { Prisma, GoodsReceiptStatus } from "@prisma/client";
import prisma from "../../prisma/db";
import type {
  CreateGoodsReceiptInput,
  UpdateGoodsReceiptInput,
  ListGoodsReceiptsInput,
} from "./goodsReceipt.types";

const goodsReceiptSelect = {
  id: true,
  receiptNo: true,
  purchaseOrderId: true,
  warehouseId: true,
  status: true,
  receivedById: true,
  notes: true,
  receivedAt: true,
  createdAt: true,
  updatedAt: true,

  purchaseOrder: {
    select: {
      id: true,
      purchaseOrderNo: true,
      status: true,
      supplier: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },

  warehouse: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },

  receivedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },

  items: {
    select: {
      id: true,
      purchaseOrderItemId: true,
      quantityReceived: true,
      quantityAccepted: true,
      quantityRejected: true,
      unitCost: true,
      purchaseOrderItem: {
        select: {
          id: true,
          productId: true,
          orderedQuantity: true,
          receivedQuantity: true,
          unitCost: true,
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.GoodsReceiptSelect;

export const GoodsReceiptRepository = {
  create(
    data: CreateGoodsReceiptInput,
    receiptNo: string,
    receivedById: string,
  ) {
    const { purchaseOrderId, items, notes, receivedAt } = data;

    return prisma.$transaction(async (tx) => {
      const purchaseOrder = await tx.purchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        select: {
          warehouseId: true,
        },
      });

      if (!purchaseOrder) {
        throw new Error("Purchase order not found");
      }

      return tx.goodsReceipt.create({
        data: {
          receiptNo,
          notes,
          receivedAt,
          purchaseOrder: {
            connect: { id: purchaseOrderId },
          },
          warehouse: {
            connect: { id: purchaseOrder.warehouseId },
          },
          receivedBy: {
            connect: { id: receivedById },
          },
          items: {
            create: items.map((item) => ({
              purchaseOrderItemId: item.purchaseOrderItemId,
              quantityReceived: item.quantityReceived,
              quantityAccepted: item.quantityAccepted,
              quantityRejected: item.quantityRejected,
              unitCost: item.unitCost,
            })),
          },
        },
        select: goodsReceiptSelect,
      });
    });
  },

  findAll(filters: ListGoodsReceiptsInput) {
    const {
      page,
      limit,
      search,
      purchaseOrderId,
      warehouseId,
      status,
      receivedFrom,
      receivedTo,
      sort,
    } = filters;

    const where: Prisma.GoodsReceiptWhereInput = {
      ...(purchaseOrderId ? { purchaseOrderId } : {}),
      ...(warehouseId ? { warehouseId } : {}),
      ...(status ? { status } : {}),

      ...(search
        ? {
          OR: [
            {
              id: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              receiptNo: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              purchaseOrder: {
                purchaseOrderNo: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
          ],
        }
        : {}),

      ...(receivedFrom || receivedTo
        ? {
          receivedAt: {
            ...(receivedFrom ? { gte: receivedFrom } : {}),
            ...(receivedTo ? { lte: receivedTo } : {}),
          },
        }
        : {}),
    };

    const sortField = sort.replace(/^-/, "");
    const descending = sort.startsWith("-");

    const orderBy: Prisma.GoodsReceiptOrderByWithRelationInput = {
      [sortField]: descending ? "desc" : "asc",
    };

    return prisma.$transaction([
      prisma.goodsReceipt.count({ where }),

      prisma.goodsReceipt.findMany({
        where,
        select: goodsReceiptSelect,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
  },

  findById(identifier: string) {
    return prisma.goodsReceipt.findFirst({
      where: {
        OR: [
          { id: identifier },
          { receiptNo: identifier },
        ],
      },
      select: goodsReceiptSelect,
    });
  },

  findPurchaseOrder(purchaseOrderId: string) {
    return prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      select: {
        id: true,
        warehouseId: true,
        status: true,
        items: {
          select: {
            id: true,
            productId: true,
            orderedQuantity: true,
            receivedQuantity: true,
            unitCost: true,
          },
        },
      },
    });
  },

  update(
    id: string,
    data: UpdateGoodsReceiptInput,
  ) {
    const { items, ...receiptData } = data;

    return prisma.$transaction(async (tx) => {
      return tx.goodsReceipt.update({
        where: { id },
        data: {
          ...receiptData,

          ...(items
            ? {
              items: {
                deleteMany: {},
                create: items.map((item) => ({
                  purchaseOrderItemId: item.purchaseOrderItemId,
                  quantityReceived: item.quantityReceived,
                  quantityAccepted: item.quantityAccepted,
                  quantityRejected: item.quantityRejected,
                  unitCost: item.unitCost,
                })),
              },
            }
            : {}),
        },
        select: goodsReceiptSelect,
      });
    });
  },

  updateStatus(
    id: string,
    status: GoodsReceiptStatus,
  ) {
    return prisma.goodsReceipt.update({
      where: { id },
      data: { status },
      select: goodsReceiptSelect,
    });
  },
}; 
