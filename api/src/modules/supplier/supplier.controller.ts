import AsyncHandler from "../../shared/asyncHandler";
import ApiResponse from "../../shared/apiResponse";
import ApiError from "../../shared/apiError";
import { SupplierService } from "./supplier.service";
import { listSuppliersSchema } from "./supplier.types";
import type {
  CreateSupplierInput,
  UpdateSupplierInput,
} from "./supplier.types";

export const createSupplierController = AsyncHandler(async (req, res) => {
  const supplier = await SupplierService.create(
    req.body as CreateSupplierInput,
  );

  res
    .status(201)
    .json(new ApiResponse("Supplier created successfully", supplier));
});

export const listSuppliersController = AsyncHandler(async (req, res) => {
  const parsed = listSuppliersSchema.safeParse(req.query);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid supplier query parameters");
  }

  const result = await SupplierService.list(parsed.data);

  res
    .status(200)
    .json(new ApiResponse("Suppliers retrieved successfully", result));
});

export const getSupplierController = AsyncHandler(async (req, res) => {
  const id = Array.isArray(req.params.id)
    ? req.params.id[0]
    : req.params.id;

  if (!id) {
    throw new ApiError(400, "Supplier ID is required");
  }

  const supplier = await SupplierService.getById(id);

  res
    .status(200)
    .json(new ApiResponse("Supplier retrieved successfully", supplier));
});

export const updateSupplierController = AsyncHandler(async (req, res) => {
  const id = Array.isArray(req.params.id)
    ? req.params.id[0]
    : req.params.id;

  if (!id) {
    throw new ApiError(400, "Supplier ID is required");
  }

  const supplier = await SupplierService.update(
    id,
    req.body as UpdateSupplierInput,
  );

  res
    .status(200)
    .json(new ApiResponse("Supplier updated successfully", supplier));
});

export const deleteSupplierController = AsyncHandler(async (req, res) => {
  const id = Array.isArray(req.params.id)
    ? req.params.id[0]
    : req.params.id;

  if (!id) {
    throw new ApiError(400, "Supplier ID is required");
  }

  const supplier = await SupplierService.delete(id);

  res
    .status(200)
    .json(new ApiResponse("Supplier deleted successfully", supplier));
});

