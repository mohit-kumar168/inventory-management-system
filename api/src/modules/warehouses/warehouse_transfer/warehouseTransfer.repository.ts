import {
  Prisma,
  ProductStatus,
  WarehouseStatus,
  WarehouseTransferStatus
} from "@prisma/client";
import prisma from "../../../prisma/db";
import type {
  CreateWarehouseTransferInput,
  UpdateWarehouseTransferInput,
  ListWarehouseTransfersInput,
  DispatchWarehouseTransferInput,
  ReceiveWarehouseTransferInput,
} from "./warehouseTransfer.types";

const warehouseTransferSelect = {
  id: true,
  transferNo: true,
  sourceWarehouseId: true,
  destinationWarehouseId: true,
  status: true,
  notes: true,
  createdById: true,
  idempotencyKey: true,
  requestedAt: true,
  dispatchedAt: true,
  receivedAt: true,
  createdAt: true,
  updatedAt: true,
  sourceWarehouse: {
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
    },
  },
  destinationWarehouse: {
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
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
  items: {
    select: {
      id: true,
      transferId: true,
      productId: true,
      quantityRequested: true,
      quantityDispatched: true,
      quantityReceived: true,
      createdAt: true,
      updatedAt: true,
      product: {
        select: {
          id: true,
          sku: true,
          name: true,
          productStatus: true,
        },
      },
      stockMovement: true,
    },
  },
};

const warehouseTransferRepository = {
  async create(
    data: CreateWarehouseTransferInput,
    createdById: string,
    transferNo: string,
    idempotencyKey: string,
  ) {
    return prisma.$transaction(
      async (tx) => {
        if (data.sourceWarehouseId === data.destinationWarehouseId) {
          throw new Error("Source and destination warehouses must be different");
        }

        const [sourceWarehouse, destinationWarehouse] = await Promise.all([
          tx.warehouse.findUnique({
            where: {
              id: data.sourceWarehouseId
            },
            select: {
              id: true,
              status: true
            },
          }),
          tx.warehouse.findUnique({
            where: {
              id: data.destinationWarehouseId
            },
            select: {
              id: true,
              status: true
            },
          }),
        ]);
        if (
          !sourceWarehouse ||
          sourceWarehouse.status !== WarehouseStatus.ACTIVE
        ) {
          throw new Error("Source warehouse not found or inactive");
        }

        if (
          !destinationWarehouse ||
          destinationWarehouse.status !== WarehouseStatus.ACTIVE
        ) {
          throw new Error("Destination warehouse not found or inactive");
        }

        const productIds = data.items.map((item) => item.productId);

        const products = await tx.product.findMany({
          where: {
            id: { in: productIds },
            productStatus: ProductStatus.ACTIVE,
          },
          select: { id: true },
        });

        if (products.length !== productIds.length) {
          throw new Error("One or more products were not found or are inactive");
        }

        return tx.warehouseTransfer.create({
          data: {
            transferNo,
            sourceWarehouseId: data.sourceWarehouseId,
            destinationWarehouseId: data.destinationWarehouseId,
            notes: data.notes,
            createdById,
            idempotencyKey,
            items: {
              create: data.items.map((item) => ({
                productId: item.productId,
                quantityRequested: item.quantityRequested,
              })),
            },
          },
          select: warehouseTransferSelect,
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  },

  findByIdempotencyKey(idempotencyKey: string) {
    return prisma.warehouseTransfer.findUnique({
      where: { idempotencyKey },
      select: warehouseTransferSelect,
    });
  },

  async findAll(filters: ListWarehouseTransfersInput) {
    const where: Prisma.WarehouseTransferWhereInput = {
      ...(filters.sourceWarehouseId
        ? { sourceWarehouseId: filters.sourceWarehouseId }
        : {}),
      ...(filters.destinationWarehouseId
        ? { destinationWarehouseId: filters.destinationWarehouseId }
        : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search
        ? {
          OR: [
            {
              transferNo: {
                contains: filters.search,
                mode: "insensitive",
              },
            },
            {
              notes: {
                contains: filters.search,
                mode: "insensitive",
              },
            },
          ],
        }
        : {}),
    };

    const [items, totalItems] = await Promise.all([
      prisma.warehouseTransfer.findMany({
        where,
        select: warehouseTransferSelect,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.warehouseTransfer.count({ where }),
    ]);

    return {
      items,
      meta: {
        page: filters.page,
        limit: filters.limit,
        totalItems,
        totalPages: Math.ceil(totalItems / filters.limit),
      },
    };
  },

  findById(id: string) {
    return prisma.warehouseTransfer.findUnique({
      where: { id },
      select: warehouseTransferSelect,
    });
  },

  async update(id: string, data: UpdateWarehouseTransferInput) {
    return prisma.$transaction(
      async (tx) => {
        const existing = await tx.warehouseTransfer.findUnique({
          where: { id },
          include: { items: true },
        });

        if (!existing) {
          throw new Error("Warehouse transfer not found");
        }

        if (existing.status !== WarehouseTransferStatus.DRAFT) {
          throw new Error("Only draft transfers can be updated");
        }

        const sourceWarehouseId =
          data.sourceWarehouseId ?? existing.sourceWarehouseId;
        const destinationWarehouseId =
          data.destinationWarehouseId ?? existing.destinationWarehouseId;

        if (sourceWarehouseId === destinationWarehouseId) {
          throw new Error("Source and destination warehouses must be different");
        }

        if (data.sourceWarehouseId || data.destinationWarehouseId) {
          const [sourceWarehouse, destinationWarehouse] = await Promise.all([
            tx.warehouse.findUnique({
              where: { id: sourceWarehouseId },
              select: { id: true, status: true },
            }),
            tx.warehouse.findUnique({
              where: { id: destinationWarehouseId },
              select: { id: true, status: true },
            }),
          ]);

          if (
            !sourceWarehouse ||
            sourceWarehouse.status !== WarehouseStatus.ACTIVE
          ) {
            throw new Error("Source warehouse not found or inactive");
          }

          if (
            !destinationWarehouse ||
            destinationWarehouse.status !== WarehouseStatus.ACTIVE
          ) {
            throw new Error("Destination warehouse not found or inactive");
          }
        }

        if (data.items) {
          const productIds = data.items.map((item) => item.productId);

          const products = await tx.product.findMany({
            where: {
              id: { in: productIds },
              productStatus: ProductStatus.ACTIVE,
            },
            select: { id: true },
          });

          if (products.length !== productIds.length) {
            throw new Error(
              "One or more products were not found or are inactive",
            );
          }
        }

        return tx.warehouseTransfer.update({
          where: { id },
          data: {
            ...(data.sourceWarehouseId ? { sourceWarehouseId } : {}),
            ...(data.destinationWarehouseId ? { destinationWarehouseId } : {}),
            ...(data.notes !== undefined ? { notes: data.notes } : {}),
            ...(data.items
              ? {
                items: {
                  deleteMany: {},
                  create: data.items.map((item) => ({
                    productId: item.productId,
                    quantityRequested: item.quantityRequested,
                  })),
                },
              }
              : {}),
          },
          select: warehouseTransferSelect,
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  },

  async submitForApproval(id: string) {
    return prisma.warehouseTransfer.updateMany({
      where: {
        id,
        status: WarehouseTransferStatus.DRAFT,
      },
      data: {
        status: WarehouseTransferStatus.PENDING_APPROVAL,
      },
    });
  },

  async approve(id: string) {
    return prisma.warehouseTransfer.updateMany({
      where: {
        id,
        status: WarehouseTransferStatus.PENDING_APPROVAL,
      },
      data: {
        status: WarehouseTransferStatus.APPROVED,
      },
    });
  },

  async dispatch(
    id: string,
    data: DispatchWarehouseTransferInput,
    createdById: string,
  ) {
    return prisma.$transaction(
      async (tx) => {
        const transfer = await tx.warehouseTransfer.findUnique({
          where: { id },
          include: { items: true },
        });

        if (!transfer) {
          throw new Error("Warehouse transfer not found");
        }

        if (transfer.status !== WarehouseTransferStatus.APPROVED) {
          throw new Error("Only approved transfers can be dispatched");
        }

        const requestedItemIds = new Set(
          transfer.items.map((item) => item.id),
        );

        const receivedItemIds = new Set<string>();

        for (const item of data.items) {
          if (!requestedItemIds.has(item.transferItemId)) {
            throw new Error("Transfer item does not belong to this transfer");
          }

          if (receivedItemIds.has(item.transferItemId)) {
            throw new Error("Duplicate transfer items are not allowed");
          }

          receivedItemIds.add(item.transferItemId);
        }

        const dispatchQuantities = new Map(
          data.items.map((item) => [item.transferItemId, item.quantity]),
        );

        const itemsToDispatch = transfer.items.map((item) => ({
          ...item,
          quantityToDispatch: dispatchQuantities.get(item.id) ?? 0,
        }));

        if (
          !itemsToDispatch.some((item) => item.quantityToDispatch > 0)
        ) {
          throw new Error("At least one transfer item must be dispatched");
        }

        for (const item of itemsToDispatch) {
          if (item.quantityToDispatch < 0 ||
            item.quantityToDispatch > item.quantityRequested) {
            throw new Error("Invalid dispatch quantity");
          }

          if (item.quantityToDispatch === 0) {
            continue;
          }

          const balance = await tx.inventoryBalance.findUnique({
            where: {
              productId_warehouseId: {
                productId: item.productId,
                warehouseId: transfer.sourceWarehouseId,
              },
            },
          });

          if (
            !balance ||
            balance.onHandQuantity - balance.reservedQuantity <
            item.quantityToDispatch
          ) {
            throw new Error(
              `Insufficient available stock for product ${item.productId}`,
            );
          }

          const updatedBalance = await tx.inventoryBalance.updateMany({
            where: {
              id: balance.id,
              version: balance.version,
              onHandQuantity: { gte: item.quantityToDispatch },
              reservedQuantity: {
                lte: balance.onHandQuantity - item.quantityToDispatch,
              },
            },
            data: {
              onHandQuantity: {
                decrement: item.quantityToDispatch,
              },
              version: { increment: 1 },
            },
          });

          if (updatedBalance.count !== 1) {
            throw new Error(
              `Stock changed while dispatching product ${item.productId}. Please retry`,
            );
          }

          await tx.warehouseTransferItem.update({
            where: { id: item.id },
            data: {
              quantityDispatched: item.quantityToDispatch,
            },
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              warehouseId: transfer.sourceWarehouseId,
              movementType: "TRANSFER_OUT",
              quantityDelta: -item.quantityToDispatch,
              transferItemId: item.id,
              createdById,
            },
          });
        }

        return tx.warehouseTransfer.update({
          where: { id },
          data: {
            status: WarehouseTransferStatus.DISPATCHED,
            dispatchedAt: new Date(),
          },
          select: warehouseTransferSelect,
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  },

  async receive(
    id: string,
    data: ReceiveWarehouseTransferInput,
    createdById: string,
  ) {
    return prisma.$transaction(
      async (tx) => {
        const transfer = await tx.warehouseTransfer.findUnique({
          where: { id },
          include: { items: true },
        });

        if (!transfer) {
          throw new Error("Warehouse transfer not found");
        }

        if (
          transfer.status !== WarehouseTransferStatus.DISPATCHED &&
          transfer.status !== WarehouseTransferStatus.PARTIALLY_RECEIVED
        ) {
          throw new Error("This transfer cannot receive items in its current state");
        }

        const transferItemIds = new Set(
          transfer.items.map((item) => item.id),
        );

        const receivedItemIds = new Set<string>();

        for (const item of data.items) {
          if (!transferItemIds.has(item.transferItemId)) {
            throw new Error("Transfer item does not belong to this transfer");
          }

          if (receivedItemIds.has(item.transferItemId)) {
            throw new Error("Duplicate transfer items are not allowed");
          }

          receivedItemIds.add(item.transferItemId);
        }

        for (const receivedItem of data.items) {
          const transferItem = transfer.items.find(
            (item) => item.id === receivedItem.transferItemId,
          );

          if (!transferItem) {
            throw new Error("Transfer item not found");
          }

          const remainingQuantity =
            transferItem.quantityDispatched -
            transferItem.quantityReceived;

          if (receivedItem.quantity > remainingQuantity) {
            throw new Error(
              "Received quantity cannot exceed the remaining dispatched quantity",
            );
          }

          const updatedItem = await tx.warehouseTransferItem.updateMany({
            where: {
              id: transferItem.id,
              quantityReceived: transferItem.quantityReceived,
            },
            data: {
              quantityReceived: {
                increment: receivedItem.quantity,
              },
            },
          });

          if (updatedItem.count !== 1) {
            throw new Error(
              "Transfer item changed while receiving. Please retry",
            );
          }

          if (receivedItem.quantity === 0) {
            continue;
          }

          await tx.inventoryBalance.upsert({
            where: {
              productId_warehouseId: {
                productId: transferItem.productId,
                warehouseId: transfer.destinationWarehouseId,
              },
            },
            create: {
              productId: transferItem.productId,
              warehouseId: transfer.destinationWarehouseId,
              onHandQuantity: receivedItem.quantity,
            },
            update: {
              onHandQuantity: {
                increment: receivedItem.quantity,
              },
              version: { increment: 1 },
            },
          });

          await tx.stockMovement.create({
            data: {
              productId: transferItem.productId,
              warehouseId: transfer.destinationWarehouseId,
              movementType: "TRANSFER_IN",
              quantityDelta: receivedItem.quantity,
              transferItemId: transferItem.id,
              createdById,
            },
          });
        }

        const updatedItems = await tx.warehouseTransferItem.findMany({
          where: { transferId: id },
          select: {
            quantityDispatched: true,
            quantityReceived: true,
          },
        });

        const fullyReceived = updatedItems.every(
          (item) =>
            item.quantityReceived === item.quantityDispatched,
        );

        return tx.warehouseTransfer.update({
          where: { id },
          data: {
            status: fullyReceived
              ? WarehouseTransferStatus.RECEIVED
              : WarehouseTransferStatus.PARTIALLY_RECEIVED,
            ...(fullyReceived ? { receivedAt: new Date() } : {}),
          },
          select: warehouseTransferSelect,
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  },

  async cancel(id: string) {
    return prisma.warehouseTransfer.updateMany({
      where: {
        id,
        status: WarehouseTransferStatus.DRAFT,
      },
      data: {
        status: WarehouseTransferStatus.CANCELLED,
      },
    });
  },
};

export default warehouseTransferRepository;
