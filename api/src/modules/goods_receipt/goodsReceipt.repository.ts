import { Prisma, GoodsReceiptStatus, PurchaseOrderStatus, StockMovementType } from "@prisma/client";
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

  async post(id: string) {
    return prisma.$transaction(
      async (tx) => {
        const receipt = await tx.goodsReceipt.findUnique({
          where: { id },
          select: {
            id: true,
            status: true,
            purchaseOrderId: true,
            warehouseId: true,
            receivedById: true,
            items: {
              select: {
                id: true,
                quantityAccepted: true,
                purchaseOrderItemId: true,
                unitCost: true,
                purchaseOrderItem: {
                  select: {
                    id: true,
                    purchaseOrderId: true,
                    productId: true,
                    orderedQuantity: true,
                    receivedQuantity: true,
                    unitCost: true,
                  },
                },
              },
            },
          },
        });

        if (!receipt) {
          throw new Error("Goods receipt not found");
        }

        if (receipt.status !== GoodsReceiptStatus.DRAFT) {
          throw new Error("Only draft goods receipts can be posted");
        }

        const purchaseOrder = await tx.purchaseOrder.findUnique({
          where: { id: receipt.purchaseOrderId },
          select: {
            id: true,
            status: true,
          },
        });

        if (!purchaseOrder) {
          throw new Error("Purchase order not found");
        }

        if (
          purchaseOrder.status !== PurchaseOrderStatus.ORDERED &&
          purchaseOrder.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED
        ) {
          throw new Error("Purchase order is not available for receiving goods");
        }

        let totalAcceptedQuantity = 0;

        for (const item of receipt.items) {
          const purchaseOrderItem = item.purchaseOrderItem;

          if (purchaseOrderItem.purchaseOrderId !== receipt.purchaseOrderId) {
            throw new Error("Purchase order item does not belong to this purchase order");
          }

          const remainingQuantity =
            purchaseOrderItem.orderedQuantity -
            purchaseOrderItem.receivedQuantity;

          if (item.quantityAccepted > remainingQuantity) {
            throw new Error(
              `Accepted quantity exceeds remaining quantity for product ${purchaseOrderItem.productId}`,
            );
          }

          if (item.quantityAccepted === 0) {
            continue;
          }

          totalAcceptedQuantity += item.quantityAccepted;

          await tx.inventoryBalance.upsert({
            where: {
              productId_warehouseId: {
                productId: purchaseOrderItem.productId,
                warehouseId: receipt.warehouseId,
              },
            },
            create: {
              productId: purchaseOrderItem.productId,
              warehouseId: receipt.warehouseId,
              onHandQuantity: item.quantityAccepted,
              reservedQuantity: 0,
              version: 1,
            },
            update: {
              onHandQuantity: {
                increment: item.quantityAccepted,
              },
              version: {
                increment: 1,
              },
            },
          });

          await tx.stockMovement.create({
            data: {
              productId: purchaseOrderItem.productId,
              warehouseId: receipt.warehouseId,
              movementType: StockMovementType.PURCHASE_IN,
              quantityDelta: item.quantityAccepted,
              unitCost: item.unitCost ?? purchaseOrderItem.unitCost,
              goodsReceiptItemId: item.id,
              createdById: receipt.receivedById,
            },
          });

          await tx.purchaseOrderItem.update({
            where: {
              id: purchaseOrderItem.id,
            },
            data: {
              receivedQuantity: {
                increment: item.quantityAccepted,
              },
            },
          });
        }

        if (totalAcceptedQuantity > 0) {
          const purchaseOrderItems = await tx.purchaseOrderItem.findMany({
            where: {
              purchaseOrderId: receipt.purchaseOrderId,
            },
            select: {
              orderedQuantity: true,
              receivedQuantity: true,
            },
          });

          const fullyReceived = purchaseOrderItems.every(
            (item) => item.receivedQuantity >= item.orderedQuantity,
          );

          await tx.purchaseOrder.update({
            where: {
              id: receipt.purchaseOrderId,
            },
            data: {
              status: fullyReceived
                ? PurchaseOrderStatus.RECEIVED
                : PurchaseOrderStatus.PARTIALLY_RECEIVED,
            },
          });
        }

        return tx.goodsReceipt.update({
          where: { id },
          data: {
            status: GoodsReceiptStatus.POSTED,
          },
          select: goodsReceiptSelect,
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
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
