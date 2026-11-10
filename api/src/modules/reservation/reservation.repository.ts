import { Prisma, ProductStatus, ReservationStatus, SalesOrderStatus, WarehouseStatus } from "@prisma/client";
import type {
  CreateReservationInput,
  ListReservationsInput,
} from "./reservation.types";
import prisma from "../../prisma/db";

const reservationSelect = {
  id: true,
  salesOrderItemId: true,
  productId: true,
  warehouseId: true,
  quantity: true,
  quantityConsumed: true,
  quantityReleased: true,
  status: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
  salesOrderItem: {
    select: {
      id: true,
      salesOrderId: true,
      productNameSnapshot: true,
      skuSnapshot: true,
      quantity: true,
      salesOrder: {
        select: {
          id: true,
          orderNo: true,
          status: true,
        },
      },
    },
  },
  product: {
    select: {
      id: true,
      sku: true,
      name: true,
      productStatus: true,
    },
  },
  warehouse: {
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
    },
  },
};

const buildWhere = (
  filters: ListReservationsInput,
): Prisma.ReservationWhereInput => {
  const where: Prisma.ReservationWhereInput = {
    ...(filters.salesOrderItemId && {
      salesOrderItemId: filters.salesOrderItemId,
    }),
    ...(filters.productId && {
      productId: filters.productId,
    }),
    ...(filters.warehouseId && {
      warehouseId: filters.warehouseId,
    }),
    ...(filters.status && {
      status: filters.status,
    }),
  };

  if (filters.search) {
    where.OR = [
      {
        product: {
          name: {
            contains: filters.search,
            mode: "insensitive",
          },
        },
      },
      {
        product: {
          sku: {
            contains: filters.search,
            mode: "insensitive",
          },
        },
      },
      {
        salesOrderItem: {
          salesOrder: {
            orderNo: {
              contains: filters.search,
              mode: "insensitive",
            },
          },
        },
      },
    ];
  }

  return where;
};

export const ReservationRepository = {
  async create(data: CreateReservationInput) {
    return prisma.$transaction(
      async (tx) => {
        const salesOrderItem = await tx.salesOrderItem.findUnique({
          where: { id: data.salesOrderItemId },
          select: {
            id: true,
            productId: true,
            quantity: true,
            salesOrder: {
              select: {
                status: true,
              },
            },
            product: {
              select: {
                productStatus: true,
              },
            },
          },
        });

        if (!salesOrderItem) {
          throw new Error("Sales order item not found");
        }

        if (salesOrderItem.salesOrder.status !== SalesOrderStatus.CONFIRMED) {
          throw new Error("Reservations require a confirmed sales order");
        }

        if (salesOrderItem.product.productStatus !== ProductStatus.ACTIVE) {
          throw new Error("Product is not active");
        }

        const warehouse = await tx.warehouse.findUnique({
          where: { id: data.warehouseId },
          select: {
            id: true,
            status: true,
          },
        });

        if (!warehouse) {
          throw new Error("Warehouse not found");
        }

        if (warehouse.status !== WarehouseStatus.ACTIVE) {
          throw new Error("Warehouse is not active");
        }

        const inventoryBalance = await tx.inventoryBalance.findUnique({
          where: {
            productId_warehouseId: {
              productId: salesOrderItem.productId,
              warehouseId: data.warehouseId,
            },
          },
          select: {
            id: true,
            onHandQuantity: true,
            reservedQuantity: true,
          },
        });

        if (!inventoryBalance) {
          throw new Error("Inventory balance not found");
        }

        const existingReservations = await tx.reservation.findMany({
          where: {
            salesOrderItemId: data.salesOrderItemId,
          },
          select: {
            quantity: true,
            quantityConsumed: true,
            quantityReleased: true,
          },
        });

        const consumedQuantity = existingReservations.reduce(
          (total, reservation) => total + reservation.quantityConsumed,
          0,
        );

        const outstandingQuantity = existingReservations.reduce(
          (total, reservation) =>
            total +
            reservation.quantity -
            reservation.quantityConsumed -
            reservation.quantityReleased,
          0,
        );

        const remainingOrderQuantity =
          salesOrderItem.quantity - consumedQuantity - outstandingQuantity;

        if (data.quantity > remainingOrderQuantity) {
          throw new Error("Reservation quantity exceeds remaining order quantity");
        }

        const availableQuantity =
          inventoryBalance.onHandQuantity -
          inventoryBalance.reservedQuantity;

        if (data.quantity > availableQuantity) {
          throw new Error("Insufficient available inventory");
        }

        await tx.inventoryBalance.update({
          where: { id: inventoryBalance.id },
          data: {
            reservedQuantity: {
              increment: data.quantity,
            },
            version: {
              increment: 1,
            },
          },
        });

        return tx.reservation.create({
          data: {
            salesOrderItemId: data.salesOrderItemId,
            productId: salesOrderItem.productId,
            warehouseId: data.warehouseId,
            quantity: data.quantity,
            expiresAt: data.expiresAt,
          },
          select: reservationSelect,
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  },

  async findAll(filters: ListReservationsInput) {
    const where = buildWhere(filters);
    const skip = (filters.page - 1) * filters.limit;

    const [reservations, total] = await prisma.$transaction([
      prisma.reservation.findMany({
        where,
        select: reservationSelect,
        skip,
        take: filters.limit,
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.reservation.count({ where }),
    ]);

    return {
      reservations,
      pagination: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  },

  async findById(id: string) {
    return prisma.reservation.findUnique({
      where: { id },
      select: reservationSelect,
    });
  },

  async findExpired(now: Date = new Date()) {
    return prisma.reservation.findMany({
      where: {
        status: {
          in: [
            ReservationStatus.ACTIVE,
            ReservationStatus.PARTIALLY_CONSUMED,
          ],
        },
        expiresAt: {
          lte: now,
        },
      },
      select: reservationSelect,
    });
  },
};
