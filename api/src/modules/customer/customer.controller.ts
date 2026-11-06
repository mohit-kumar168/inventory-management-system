
import AsyncHandler from "../../shared/asyncHandler";
import ApiResponse from "../../shared/apiResponse";
import ApiError from "../../shared/apiError";
import { CustomerService } from "./customer.service";
import { listCustomersSchema } from "./customer.types";
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
} from "./customer.types";

export const createCustomerController = AsyncHandler(async (req, res) => {
  const customer = await CustomerService.create(
    req.body as CreateCustomerInput
  );

  res
    .status(201)
    .json(new ApiResponse("Customer created successfully", customer));
});

export const listCustomersController = AsyncHandler(async (req, res) => {
  const parsed = listCustomersSchema.safeParse(req.query);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid customer query parameters");
  }

  const result = await CustomerService.list(parsed.data);

  res
    .status(200)
    .json(new ApiResponse("Customers retrieved successfully", result));
});

export const getCustomerController = AsyncHandler(async (req, res) => {
  const id = req.params.id as string;

  if (!id) {
    throw new ApiError(400, "Customer ID is required");
  }

  const customer = await CustomerService.getById(id);

  res
    .status(200)
    .json(new ApiResponse("Customer retrieved successfully", customer));
});

export const updateCustomerController = AsyncHandler(async (req, res) => {
  const id = req.params.id as string;

  if (!id) {
    throw new ApiError(400, "Customer ID is required");
  }

  const customer = await CustomerService.update(
    id,
    req.body as UpdateCustomerInput
  );

  res
    .status(200)
    .json(new ApiResponse("Customer updated successfully", customer));
});

export const deleteCustomerController = AsyncHandler(async (req, res) => {
  const id = req.params.id as string;

  if (!id) {
    throw new ApiError(400, "Customer ID is required");
  }

  const customer = await CustomerService.delete(id);

  res
    .status(200)
    .json(new ApiResponse("Customer deleted successfully", customer));
});

