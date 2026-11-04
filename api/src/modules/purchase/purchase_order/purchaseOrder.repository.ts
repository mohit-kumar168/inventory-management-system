
import { Prisma, PurchaseOrderStatus } from "@prisma/client";
import prisma from "../../../prisma/db";

import type {
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
  ListPurchaseOrdersInput,
} from "./purchaseOrder.types";

const purchaseOrderSelect = {
  id: true,
  purchaseOrderNo: true,
  supplierId: true,
  warehouseId: true,
  status: true,
  currency: true,
  subtotal: true,
  discountAmount: true,
  shippingAmount: true,
  totalAmount: true,
  notes: true,
  createdById: true,
  approvedById: true,
  orderedAt: true,
  expectedAt: true,
  createdAt: true,
  updatedAt: true,

  supplier: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  },

  warehouse: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },

  createdBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },

  approvedBy: {
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
      productId: true,
      orderedQuantity: true,
      receivedQuantity: true,
      unitCost: true,
      discountAmount: true,
      lineTotal: true,

      product: {
        select: {
          id: true,
          sku: true,
          name: true,
        },
      },
    },
  },
};

function calculateLineTotal(
  orderedQuantity: number,
  unitCost: number,
  discountAmount: number,
) {
  return orderedQuantity * unitCost - discountAmount;
}

export const PurchaseOrderRepository = {
  async create(
    data: CreatePurchaseOrderInput,
    createdById: string,
    purchaseOrderNo: string,
    idempotencyKey?: string,
  ) {
    const {
      items,
      supplierId,
      warehouseId,
      discountAmount = 0,
      shippingAmount = 0,
      ...purchaseOrderData
    } = data;

    const subtotal = items.reduce(
      (sum, item) =>
        sum + item.orderedQuantity * item.unitCost - item.discountAmount,
      0,
    );

    const totalAmount = subtotal - discountAmount + shippingAmount;

    return prisma.purchaseOrder.create({
      data: {
        ...purchaseOrderData,
        purchaseOrderNo,
        supplier: {
          connect: { id: supplierId },
        },
        warehouse: {
          connect: { id: warehouseId },
        },
        createdBy: {
          connect: { id: createdById },
        },
        items: {
          create: items.map((item) => ({
            orderedQuantity: item.orderedQuantity,
            unitCost: item.unitCost,
            discountAmount: item.discountAmount,
            lineTotal:
              item.orderedQuantity * item.unitCost - item.discountAmount,
            product: {
              connect: { id: item.productId },
            },
          })),
        },
        discountAmount,
        shippingAmount,
        subtotal,
        totalAmount,
        idempotencyKey,
      },
      select: purchaseOrderSelect,
    });
  },

  findByIdempotencyKey(idempotencyKey: string) {
    return prisma.purchaseOrder.findUnique({
      where: { idempotencyKey },
      select: purchaseOrderSelect,
    });
  },

  findAll(filters: ListPurchaseOrdersInput) {
    const {
      page,
      limit,
      search,
      supplierId,
      warehouseId,
      status,
      createdFrom,
      createdTo,
      sort,
    } = filters;

    const where: Prisma.PurchaseOrderWhereInput = {
      ...(supplierId ? { supplierId } : {}),
      ...(warehouseId ? { warehouseId } : {}),
      ...(status ? { status } : {}),

      ...(search
        ? {
          OR: [
            {
              purchaseOrderNo: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              purchaseOrderNo: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              supplier: {
                name: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
          ],
        }
        : {}),

      ...(createdFrom || createdTo
        ? {
          createdAt: {
            ...(createdFrom ? { gte: createdFrom } : {}),
            ...(createdTo ? { lte: createdTo } : {}),
          },
        }
        : {}),
    };

    const sortField = sort.replace(/^-/, "");
    const descending = sort.startsWith("-");

    const orderBy: Prisma.PurchaseOrderOrderByWithRelationInput = {
      [sortField]: descending ? "desc" : "asc",
    };

    return prisma.$transaction([
      prisma.purchaseOrder.count({ where }),

      prisma.purchaseOrder.findMany({
        where,
        select: purchaseOrderSelect,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
  },

  findById(identifier: string) {
    return prisma.purchaseOrder.findFirst({
      where: {
        OR: [
          { id: identifier },
          { purchaseOrderNo: identifier },
        ],
      },
      select: purchaseOrderSelect,
    });
  },

  async update(
    id: string,
    data: UpdatePurchaseOrderInput,
  ) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.purchaseOrder.findUnique({
        where: { id },
        select: {
          subtotal: true,
          discountAmount: true,
          shippingAmount: true,
        },
      });

      if (!existing) {
        throw new Prisma.PrismaClientKnownRequestError(
          "Purchase order not found",
          {
            code: "P2025",
            clientVersion: Prisma.prismaVersion.client,
          },
        );
      }

      const {
        items,
        discountAmount,
        shippingAmount,
        ...purchaseOrderData
      } = data;

      let subtotal = existing.subtotal;

      if (items) {
        subtotal = items.reduce(
          (sum, item) =>
            sum +
            calculateLineTotal(
              item.orderedQuantity,
              item.unitCost,
              item.discountAmount,
            ),
          0,
        );
      }

      const finalDiscountAmount =
        discountAmount ?? existing.discountAmount;

      const finalShippingAmount =
        shippingAmount ?? existing.shippingAmount;

      const totalAmount =
        subtotal - finalDiscountAmount + finalShippingAmount;

      return tx.purchaseOrder.update({
        where: { id },

        data: {
          ...purchaseOrderData,
          subtotal,
          discountAmount: finalDiscountAmount,
          shippingAmount: finalShippingAmount,
          totalAmount,

          ...(items
            ? {
              items: {
                deleteMany: {},
                create: items.map((item) => ({
                  productId: item.productId,
                  orderedQuantity: item.orderedQuantity,
                  unitCost: item.unitCost,
                  discountAmount: item.discountAmount,
                  lineTotal: calculateLineTotal(
                    item.orderedQuantity,
                    item.unitCost,
                    item.discountAmount,
                  ),
                })),
              },
            }
            : {}),
        },

        select: purchaseOrderSelect,
      });
    });
  },

  updateStatus(
    id: string,
    status: PurchaseOrderStatus,
    approvedById?: string,
  ) {
    return prisma.purchaseOrder.update({
      where: { id },

      data: {
        status,

        ...(approvedById ? { approvedById } : {}),

        ...(status === PurchaseOrderStatus.ORDERED
          ? { orderedAt: new Date() }
          : {}),
      },

      select: purchaseOrderSelect,
    });
  },
};

