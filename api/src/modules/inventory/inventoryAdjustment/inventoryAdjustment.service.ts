import ApiError from "../../../shared/apiError";
import logger from "../../../config/logger";
import InventoryAdjustmentRepository from "./inventoryAdjustment.repository";
import type {
  CreateInventoryAdjustmentInput,
  ListInventoryAdjustmentsInput,
} from "./inventoryAdjustment.types";

const generateAdjustmentNo = (): string => {
  return `ADJ-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
};

export const InventoryAdjustmentService = {
  async create(
    data: CreateInventoryAdjustmentInput,
    createdById: string,
    idempotencyKey: string,
  ) {
    if (!idempotencyKey.trim()) {
      throw new ApiError(400, "Idempotency key header is required");
    }

    const existing = await InventoryAdjustmentRepository.findByIdempotencyKey(idempotencyKey);

    if (existing) {
      logger.info(
        { adjustmentId: existing.id },
        "Returning existing inventory adjustment for idempotency key",
      );
      return existing;
    }

    const adjustment = await InventoryAdjustmentRepository.create(
      data,
      createdById,
      idempotencyKey,
      generateAdjustmentNo(),
    );

    logger.info(
      {
        adjustmentId: adjustment.id,
        adjustmentNo: adjustment.adjustmentNo,
        createdById: createdById,
      },
      "Inventroy adjustment created",
    );

    return adjustment;
  },

  async list(filters: ListInventoryAdjustmentsInput) {
    return InventoryAdjustmentRepository.findAll(filters);
  },

  async getById(id: string) {
    const adjustment = await InventoryAdjustmentRepository.findById(id);

    if (!adjustment) {
      throw new ApiError(404, "Inventory adjustment not found");
    }

    return adjustment;
  },
};
