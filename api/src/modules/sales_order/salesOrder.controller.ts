
import AsyncHandler from "../../shared/asyncHandler";
import ApiResponse from "../../shared/apiResponse";
import ApiError from "../../shared/apiError";
import { SalesOrderService } from "./salesOrder.service";
import {
  createSalesOrderSchema,
  updateSalesOrderSchema,
  listSalesOrdersSchema,
} from "./salesOrder.types";
import type {
  CreateSalesOrderInput,
  UpdateSalesOrderInput,
} from "./salesOrder.types";

export const createSalesOrderController = AsyncHandler(
  async (req, res) => {
    const parsed = createSalesOrderSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ApiError(400, "Invalid sales order data");
    }

    const idempotencyKey = req.headers["idempotency-key"];

    const key = Array.isArray(idempotencyKey)
      ? idempotencyKey[0]
      : idempotencyKey;

    if (!key?.trim()) {
      throw new ApiError(400, "Idempotency-Key header is required");
    }

    const salesOrder = await SalesOrderService.create(
      parsed.data as CreateSalesOrderInput,
      req.user?.id!,
      key,
    );

    res
      .status(201)
      .json(
        new ApiResponse(
          "Sales order created successfully",
          salesOrder,
        ),
      );
  },
);

export const listSalesOrdersController = AsyncHandler(
  async (req, res) => {
    const parsed = listSalesOrdersSchema.safeParse(req.query);

    if (!parsed.success) {
      throw new ApiError(400, "Invalid sales order query parameters");
    }

    const result = await SalesOrderService.list(parsed.data);

    res
      .status(200)
      .json(
        new ApiResponse(
          "Sales orders retrieved successfully",
          result,
        ),
      );
  },
);

export const getSalesOrderController = AsyncHandler(
  async (req, res) => {
    const id = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    if (!id) {
      throw new ApiError(400, "Sales order ID is required");
    }

    const salesOrder = await SalesOrderService.getById(id);

    res
      .status(200)
      .json(
        new ApiResponse(
          "Sales order retrieved successfully",
          salesOrder,
        ),
      );
  },
);

export const updateSalesOrderController = AsyncHandler(
  async (req, res) => {
    const id = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    if (!id) {
      throw new ApiError(400, "Sales order ID is required");
    }

    const parsed = updateSalesOrderSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ApiError(400, "Invalid sales order update data");
    }

    const salesOrder = await SalesOrderService.update(
      id,
      parsed.data as UpdateSalesOrderInput,
    );

    res
      .status(200)
      .json(
        new ApiResponse(
          "Sales order updated successfully",
          salesOrder,
        ),
      );
  },
);

