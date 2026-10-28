import prisma from "../../../prisma/db";
import type {
  CreateInventoryAdjustmentInput,
  ListInventoryAdjustmentsInput,
} from "./inventoryAdjustment.types";

export const InventoryAdjustmentRepository = {
  async create(
    data: CreateInventoryAdjustmentInput,
    createdById: string,
    idempotencyKey: string,
    adjustmentNo: string,
  ) {
    return prisma.inventoryAdjustment.create({
      data: {
        adjustmentNo,
        warehouseId: data.warehouseId,
        reason: data.reason,
        notes: data.notes,
        createdById,
        idempotencyKey,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            quantityDelta: item.quantityDelta,
          })),
        },
      },
      include: {
        warehouse: {
          select: {
            id: true,
            code: true,
            name: true
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                name: true
              },
            },
          },
        },
      },
    });
  },

  async findAll(filters: ListInventoryAdjustmentsInput) {
    const where = {
      ...(filters.warehouseId
        ? { warehouseId: filters.warehouseId }
        : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.createdById
        ? { createdById: filters.createdById }
        : {}),
      ...(filters.createdFrom || filters.createdTo
        ? {
          createdAt: {
            ...(filters.createdFrom
              ? { gte: filters.createdFrom }
              : {}),
            ...(filters.createdTo
              ? { lte: filters.createdTo }
              : {}),
          },
        }
        : {}),
    };

    const orderBy = {
      createdAt: filters.sort === "createdAt" ? "asc" as const : "desc" as const,
    };

    const [items, totalItems] = await prisma.$transaction([
      prisma.inventoryAdjustment.findMany({
        where,
        orderBy,
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        include: {
          warehouse: {
            select: { id: true, code: true, name: true },
          },
          items: {
            include: {
              product: {
                select: { id: true, sku: true, name: true },
              },
            },
          },
        },
      }),
      prisma.inventoryAdjustment.count({ where }),
    ]);

    return {
      items,
      meta: {
        page: filters.page,
        pageSize: filters.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / filters.pageSize),
      },
    };
  },

  findById(id: string) {
    return prisma.inventoryAdjustment.findUnique({
      where: { id },
      include: {
        warehouse: {
          select: { id: true, code: true, name: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, sku: true, name: true },
            },
            stockMovements: true,
          },
        },
      },
    });
  },

  findByIdempotencyKey(idempotencyKey: string) {
    return prisma.inventoryAdjustment.findUnique({
      where: { idempotencyKey },
      include: {
        items: true,
      },
    });
  },
};

export default InventoryAdjustmentRepository;

