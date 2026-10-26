
import prisma from "../../prisma/db";
import type {
  CreateWarehouseInput,
  UpdateWarehouseInput,
  ListWarehousesInput,
} from "./warehouse.types";

const warehouseSelect = {
  id: true,
  code: true,
  name: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  state: true,
  postalCode: true,
  country: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const WarehouseRepository = {
  create(data: CreateWarehouseInput) {
    return prisma.warehouse.create({
      data,
      select: warehouseSelect,
    });
  },

  findAll(filters: ListWarehousesInput) {
    const { page, limit, search, city, status } = filters;

    const where = {
      ...(search
        ? {
          OR: [
            {
              name: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            {
              code: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            {
              city: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
          ],
        }
        : {}),
      ...(city
        ? {
          city: {
            contains: city,
            mode: "insensitive" as const,
          },
        }
        : {}),
      ...(status ? { status } : {}),
    };

    return prisma.$transaction([
      prisma.warehouse.count({ where }),
      prisma.warehouse.findMany({
        where,
        select: {
          ...warehouseSelect,
          _count: {
            select: {
              inventoryBalances: true,
              stockMovements: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
  },

  findById(id: string) {
    return prisma.warehouse.findUnique({
      where: { id },
      select: {
        ...warehouseSelect,
        _count: {
          select: {
            inventoryBalances: true,
            stockMovements: true,
            reservations: true,
            adjustments: true,
            sourceTransfers: true,
            destinationTransfers: true,
            purchaseOrders: true,
            goodsReceipts: true,
            shipments: true,
            returnItemsToRestock: true,
          },
        },
      },
    });
  },

  findByCode(code: string) {
    return prisma.warehouse.findUnique({
      where: { code },
      select: { id: true },
    });
  },

  update(id: string, data: UpdateWarehouseInput) {
    return prisma.warehouse.update({
      where: { id },
      data,
      select: warehouseSelect,
    });
  },

  delete(id: string) {
    return prisma.warehouse.delete({
      where: { id },
      select: warehouseSelect,
    });
  },
};

