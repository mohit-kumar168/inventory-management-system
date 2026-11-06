import AsyncHandler from "../../../shared/asyncHandler";
import ApiResponse from "../../../shared/apiResponse";
import ApiError from "../../../shared/apiError";
import { PurchaseOrderService } from "./purchaseOrder.service";
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  listPurchaseOrdersSchema,
} from "./purchaseOrder.types";
import type {
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
} from "./purchaseOrder.types";

export const createPurchaseOrderController = AsyncHandler(
  async (req, res) => {
    const parsed = createPurchaseOrderSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ApiError(400, "Invalid purchase order data");
    }

    const idempotencyKey = req.headers["idempotency-key"];

    const purchaseOrder = await PurchaseOrderService.create(
      parsed.data as CreatePurchaseOrderInput,
      req.user?.id!,
      Array.isArray(idempotencyKey) ? idempotencyKey[0] : idempotencyKey,
    );

    res
      .status(201)
      .json(
        new ApiResponse(
          "Purchase order created successfully",
          purchaseOrder,
        ),
      );
  },
);

export const listPurchaseOrdersController = AsyncHandler(
  async (req, res) => {
    const parsed = listPurchaseOrdersSchema.safeParse(req.query);

    if (!parsed.success) {
      throw new ApiError(400, "Invalid purchase order query parameters");
    }

    const result = await PurchaseOrderService.list(parsed.data);

    res
      .status(200)
      .json(
        new ApiResponse(
          "Purchase orders retrieved successfully",
          result,
        ),
      );
  },
);

export const getPurchaseOrderController = AsyncHandler(
  async (req, res) => {
    const id = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    if (!id) {
      throw new ApiError(400, "Purchase order ID is required");
    }

    const purchaseOrder = await PurchaseOrderService.getById(id);

    res
      .status(200)
      .json(
        new ApiResponse(
          "Purchase order retrieved successfully",
          purchaseOrder,
        ),
      );
  },
);

export const updatePurchaseOrderController = AsyncHandler(
  async (req, res) => {
    const id = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    if (!id) {
      throw new ApiError(400, "Purchase order ID is required");
    }

    const parsed = updatePurchaseOrderSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ApiError(400, "Invalid purchase order update data");
    }

    const purchaseOrder = await PurchaseOrderService.update(
      id,
      parsed.data as UpdatePurchaseOrderInput,
    );

    res
      .status(200)
      .json(
        new ApiResponse(
          "Purchase order updated successfully",
          purchaseOrder,
        ),
      );
  },
);

export const submitPurchaseOrderController = AsyncHandler(
  async (req, res) => {
    const id = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    if (!id) {
      throw new ApiError(400, "Purchase order ID is required");
    }

    const purchaseOrder = await PurchaseOrderService.submit(id);

    res
      .status(200)
      .json(
        new ApiResponse(
          "Purchase order submitted for approval",
          purchaseOrder,
        ),
      );
  },
);

export const approvePurchaseOrderController = AsyncHandler(
  async (req, res) => {
    const id = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    if (!id) {
      throw new ApiError(400, "Purchase order ID is required");
    }

    const purchaseOrder = await PurchaseOrderService.approve(id, req.user?.id!);

    res.status(200).json(
      new ApiResponse(
        "Purchase order approved",
        purchaseOrder,
      )
    );
  }
);

export const markPurchaseOrderAsOrderedController = AsyncHandler(
  async (req, res) => {
    const id = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    if (!id) {
      throw new ApiError(400, "Purchase order ID is required");
    }

    const purchaseOrder = await PurchaseOrderService.markAsOrdered(id);

    res.status(200).json(
      new ApiResponse(
        "Purchase order marked as ordered successfully",
        purchaseOrder
      ));
  }
);

export const cancelPurchaseOrderController = AsyncHandler(
  async (req, res) => {
    const id = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    if (!id) {
      throw new ApiError(400, "Purchase order ID is required");
    }

    const purchaseOrder = await PurchaseOrderService.cancel(id);

    res
      .status(200)
      .json(
        new ApiResponse(
          "Purchase order cancelled successfully",
          purchaseOrder,
        ),
      );
  },
);
