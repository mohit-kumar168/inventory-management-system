
import AsyncHandler from "../../shared/asyncHandler";
import ApiResponse from "../../shared/apiResponse";
import ApiError from "../../shared/apiError";
import { WarehouseService } from "./warehouse.service";
import { listWarehousesSchema } from "./warehouse.types";
import type {
  CreateWarehouseInput,
  UpdateWarehouseInput,
} from "./warehouse.types";

export const createWarehouseController = AsyncHandler(async (req, res) => {
  const warehouse = await WarehouseService.create(
    req.body as CreateWarehouseInput,
  );

  res
    .status(201)
    .json(new ApiResponse("Warehouse created successfully", warehouse));
});

export const listWarehousesController = AsyncHandler(async (req, res) => {
  const parsed = listWarehousesSchema.safeParse(req.query);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid warehouse query parameters");
  }

  const result = await WarehouseService.list(parsed.data);

  res
    .status(200)
    .json(new ApiResponse("Warehouses retrieved successfully", result));
});

export const getWarehouseController = AsyncHandler(async (req, res) => {
  const id = Array.isArray(req.params.id)
    ? req.params.id[0]
    : req.params.id;

  if (!id) {
    throw new ApiError(400, "Warehouse ID is required");
  }

  const warehouse = await WarehouseService.getById(id);

  res
    .status(200)
    .json(new ApiResponse("Warehouse retrieved successfully", warehouse));
});

export const updateWarehouseController = AsyncHandler(async (req, res) => {
  const id = Array.isArray(req.params.id)
    ? req.params.id[0]
    : req.params.id;

  if (!id) {
    throw new ApiError(400, "Warehouse ID is required");
  }

  const warehouse = await WarehouseService.update(
    id,
    req.body as UpdateWarehouseInput,
  );

  res
    .status(200)
    .json(new ApiResponse("Warehouse updated successfully", warehouse));
});

export const deleteWarehouseController = AsyncHandler(async (req, res) => {
  const id = Array.isArray(req.params.id)
    ? req.params.id[0]
    : req.params.id;

  if (!id) {
    throw new ApiError(400, "Warehouse ID is required");
  }

  const warehouse = await WarehouseService.delete(id);

  res
    .status(200)
    .json(new ApiResponse("Warehouse deleted successfully", warehouse));
});

