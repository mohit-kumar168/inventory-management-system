import type { Request, Response } from "express";
import AsyncHandler from "../../../shared/asyncHandler";
import ApiError from "../../../shared/apiError";
import ApiResponse from "../../../shared/apiResponse";
import { InventoryAdjustmentService } from "./inventoryAdjustment.service";
import {
  createInventoryAdjustmentSchema,
  listInventoryAdjustmentsSchema,
} from "./inventoryAdjustment.types";

const getParam = (value: string | string[] | undefined): string => {
  const result = Array.isArray(value) ? value[0] : value;
  if (!result) {
    throw new ApiError(400, "Required route parameter is missing");
  }

  return result;
};

export const createInventoryAdjustmentController = AsyncHandler(
  async (req: Request, res: Response) => {
    const parsed = createInventoryAdjustmentSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ApiError(400, "Invalid inventory adjustment data");
    }

    const idempotencyKey = req.header("Idempotency-key");

    if (!idempotencyKey?.trim()) {
      throw new ApiError(400, "Idempotency-key header is required");
    }

    const createdById = req.user?.id;

    if (!createdById) {
      throw new ApiError(401, "Authentication required");
    }

    const adjustment = await InventoryAdjustmentService.create(parsed.data, createdById, idempotencyKey);

    res.status(201).json(
      new ApiResponse(
        "Inventory adjustment created successfully",
        adjustment,
      ),
    );
  },
);


export const listInventoryAdjustmentsController = AsyncHandler(
  async (req: Request, res: Response) => {
    const parsed = listInventoryAdjustmentsSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ApiError(400, "Invalid inventory adjustment query");
    }

    const result = await InventoryAdjustmentService.list(parsed.data);

    res.status(200).json(
      new ApiResponse(
        "Inventory adjustment retrieved successfully",
        result,
      ));
  },
);

export const getInventoryAdjustmentController = AsyncHandler(
  async (req: Request, res: Response) => {
    const id = getParam(req.params.adjustmentId);
    const adjustment = await InventoryAdjustmentService.getById(id);

    res.status(200).json(
      new ApiResponse(
        "Inventory adjustment retrieved successfully",
        adjustment,
      ));
  },
);
