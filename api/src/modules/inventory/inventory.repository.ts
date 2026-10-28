import { PurchaseOrderStatus } from "@prisma/client";
import prisma from "../../prisma/db";
import type { ListInventoryBalancesInput, ReconciliationInput } from "./inventory.types";


const balanceSelect = {
  id: true,
  productId: true,
  warehouseId: true,
  onHandQuantity: true,
  reservedQuantity: true,
  createdAt: true,
  updatedAt: true,
  product: {
    select: {
      id: true,
      sku: true,
      name: true,
      categoryId: true,
    },
  },
  warehouse: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
};

export const InventoryRepository = {
  async findAll(filters: ListInventoryBalancesInput) {
    const rows = await prisma.inventoryBalance.findMany({
      where: {
        ...(filters.productId ? { productId: filters.productId } : {}),
        ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
        ...(filters.categoryId
          ? { product: { categoryId: filters.categoryId } }
          : {}),
      },
      select: balanceSelect,
    });

    let items = rows.map((row) => ({
      ...row,
      availableQuantity: row.onHandQuantity - row.reservedQuantity,
    }));

    if (filters.nonZeroOnly) {
      items = items.filter((item) => item.onHandQuantity !== 0);
    }

    if (filters.minAvailable !== undefined) {
      items = items.filter(
        (item) => item.availableQuantity >= filters.minAvailable!,
      );
    }

    if (filters.maxAvailable !== undefined) {
      items = items.filter(
        (item) => item.availableQuantity <= filters.maxAvailable!,
      );
    }

    const sortField = filters.sort.replace(/^-/, "");
    const descending = filters.sort.startsWith("-");

    items.sort((a, b) => {
      let comparison = 0;

      if (sortField === "sku") {
        comparison = a.product.sku.localeCompare(b.product.sku);
      } else {
        comparison =
          a[sortField as keyof typeof a] as number -
          (b[sortField as keyof typeof b] as number);
      }

      return descending ? -comparison : comparison;
    });

    const totalItems = items.length;
    const start = (filters.page - 1) * filters.pageSize;

    return {
      items: items.slice(start, start + filters.pageSize),
      meta: {
        page: filters.page,
        pageSize: filters.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / filters.pageSize),
      },
    };
  },

  findById(id: string) {
    return prisma.inventoryBalance.findUnique({
      where: { id },
      select: balanceSelect,
    });
  },

  async findProductInventory(productId: string) {
    const balances = await prisma.inventoryBalance.findMany({
      where: { productId },
      select: balanceSelect,
      orderBy: {
        warehouse: { code: "asc" },
      },
    });
    const totals = balances.reduce(
      (result, balance) => ({
        onHandQuantity: result.onHandQuantity + balance.onHandQuantity,
        reservedQuantity:
          result.reservedQuantity + balance.reservedQuantity,
        availableQuantity:
          result.availableQuantity +
          balance.onHandQuantity -
          balance.reservedQuantity,
      }),
      {
        onHandQuantity: 0,
        reservedQuantity: 0,
        availableQuantity: 0,
      },
    );

    const purchaseOrderItems = await prisma.purchaseOrderItem.findMany({
      where: {
        productId,
        purchaseOrder: {
          status: {
            in: Object.values(PurchaseOrderStatus),
          }
        },
      },
      select: {
        orderedQuantity: true,
        receivedQuantity: true,
      },
    });

    const onOrderQuantity = purchaseOrderItems.reduce(
      (sum, item) => sum + Math.max(0, item.orderedQuantity - item.receivedQuantity),
      0
    );

    return {
      totals: { ...totals, onOrderQuantity },
      warehouses: balances.map((balance) => ({
        id: balance.id,
        warehouseId: balance.warehouseId,
        warehouseCode: balance.warehouse.code,
        warehouseName: balance.warehouse.name,
        onHandQuantity: balance.onHandQuantity,
        reservedQuantity: balance.reservedQuantity,
        availableQuantity: balance.onHandQuantity - balance.reservedQuantity,
        updatedAt: balance.updatedAt,
      })),
    };
  },

  async getReconciliation(filters: ReconciliationInput) {
    const balances = await prisma.inventoryBalance.findMany({
      where: {
        ...(filters.productId ? { productId: filters.productId } : {}),
        ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
      },
      select: balanceSelect,
      take: filters.limit,
      orderBy: [{ productId: "asc" }, { warehouseId: "asc" }],
    });

    const [movementGroups, reservationGroups] = await Promise.all([
      prisma.stockMovement.groupBy({
        by: ["productId", "warehouseId"],
        where: {
          ...(filters.productId ? { productId: filters.productId } : {}),
          ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
        },
        _sum: { quantityDelta: true },
      }),
      prisma.reservation.groupBy({
        by: ["productId", "warehouseId"],
        where: {
          status: "ACTIVE",
          ...(filters.productId ? { productId: filters.productId } : {}),
          ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
        },
        _sum: {
          quantity: true,
          quantityConsumed: true,
          quantityReleased: true,
        },
      }),
    ]);

    const key = (productId: string, warehouseId: string) =>
      `${productId}:${warehouseId}`;

    const movementMap = new Map(
      movementGroups.map((item) => [
        key(item.productId, item.warehouseId),
        item._sum.quantityDelta ?? 0,
      ]),
    );

    const reservationMap = new Map(
      reservationGroups.map((item) => [
        key(item.productId, item.warehouseId),
        (item._sum.quantity ?? 0) -
        (item._sum.quantityConsumed ?? 0) -
        (item._sum.quantityReleased ?? 0),
      ]),
    );

    return balances.map((balance) => {
      const id = key(balance.productId, balance.warehouseId);
      const ledgerQuantity = movementMap.get(id) ?? 0;
      const reservationQuantity = reservationMap.get(id) ?? 0;

      return {
        balanceId: balance.id,
        productId: balance.productId,
        productSku: balance.product.sku,
        productName: balance.product.name,
        warehouseId: balance.warehouseId,
        warehouseCode: balance.warehouse.code,
        onHandQuantity: balance.onHandQuantity,
        ledgerQuantity,
        reservedQuantity: balance.reservedQuantity,
        reservationQuantity,
        onHandMatchesLedger:
          balance.onHandQuantity === ledgerQuantity,
        reservedMatchesReservations:
          balance.reservedQuantity === reservationQuantity,
      };
    });
  },
};
