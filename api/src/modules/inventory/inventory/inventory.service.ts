import prisma from "../../../prisma/db";
import ApiError from "../../../shared/apiError";
import logger from "../../../config/logger";
import { InventoryRepository } from "./inventory.repository";
import type {
  ListInventoryBalancesInput,
  ReconciliationInput,
} from "./inventory.types";

export const InventoryService = {
  async listBalances(filters: ListInventoryBalancesInput) {
    const result = await InventoryRepository.findAll(filters);

    logger.debug(
      {
        page: filters.page,
        pageSize: filters.pageSize,
        totalItems: result.meta.totalItems,
      },
      "Inventory balance rerieved",
    );

    return result;
  },

  async getBalance(id: string) {
    const balance = await InventoryRepository.findById(id);

    if (!balance) {
      throw new ApiError(404, "Inventory balance not found");
    }

    return {
      ...balance,
      availableQuantity: balance.onHandQuantity - balance.reservedQuantity,
    };

  },

  async getProductInventory(productId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!product) {
      throw new ApiError(404, "Product not found");
    }

    return InventoryRepository.findProductInventory(productId);
  },

  async reconcile(filters: ReconciliationInput) {
    const result = await InventoryRepository.getReconciliation(filters);
    const discrepancies = result.filter(
      (item) =>
        item.onHandMatchesLedger ||
        item.reservedMatchesReservations,
    );

    return {
      checkedBalances: result.length,
      discrepancyCount: discrepancies.length,
      discrepancies,
    };
  },
};
