import type { Request, Response } from "express";
import AsyncHandler from "../../../shared/asyncHandler";
import ApiError from "../../../shared/apiError";
import ApiResponse from "../../../shared/apiResponse";
import WarehouseTransferService from "./warehouseTransfer.service";
import {
  createWarehouseTransferSchema,
  updateWarehouseTransferSchema,
  listWarehouseTransfersSchema,
  warehouseTransferIdSchema,
  dispatchWarehouseTransferSchema,
  receiveWarehouseTransferSchema,
} from "./warehouseTransfer.types";

const getParam = (value: string | string[] | undefined): string => {
  const result = Array.isArray(value) ? value[0] : value;

  if (!result) {
    throw new ApiError(400, "Required route parameter is missing");
  }

  return result;
};

export const createWarehouseTransferController = AsyncHandler(
  async (req: Request, res: Response) => {
    const parsed = createWarehouseTransferSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ApiError(400, "Invalid warehouse transfer data");
    }

    const idempotencyKey = req.header("Idempotency-key");

    if (!idempotencyKey?.trim()) {
      throw new ApiError(400, "Idempotency-key header is required");
    }

    const createdById = req.user?.id;

    if (!createdById) {
      throw new ApiError(401, "Authentication required");
    }

    const transfer = await WarehouseTransferService.create(
      parsed.data,
      createdById,
      idempotencyKey,
    );

    res.status(201).json(
      new ApiResponse(
        "Warehouse transfer created successfully",
        transfer,
      ),
    );
  },
);

export const listWarehouseTransfersController = AsyncHandler(
  async (req: Request, res: Response) => {
    const parsed = listWarehouseTransfersSchema.safeParse(req.query);

    if (!parsed.success) {
      throw new ApiError(400, "Invalid warehouse transfer query");
    }

    const result = await WarehouseTransferService.list(parsed.data);

    res.status(200).json(
      new ApiResponse(
        "Warehouse transfers retrieved successfully",
        result,
      ),
    );
  },
);

export const getWarehouseTransferController = AsyncHandler(
  async (req: Request, res: Response) => {
    const id = getParam(req.params.id);

    const transfer = await WarehouseTransferService.getById(id);

    res.status(200).json(
      new ApiResponse(
        "Warehouse transfer retrieved successfully",
        transfer,
      ),
    );
  },
);

export const updateWarehouseTransferController = AsyncHandler(
  async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    const parsed = updateWarehouseTransferSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ApiError(400, "Invalid warehouse transfer data");
    }

    const transfer = await WarehouseTransferService.update(
      id,
      parsed.data,
    );

    res.status(200).json(
      new ApiResponse(
        "Warehouse transfer updated successfully",
        transfer,
      ),
    );
  },
);

export const submitWarehouseTransferController = AsyncHandler(
  async (req: Request, res: Response) => {
    const id = getParam(req.params.id);

    const transfer =
      await WarehouseTransferService.submitForApproval(id);

    res.status(200).json(
      new ApiResponse(
        "Warehouse transfer submitted for approval",
        transfer,
      ),
    );
  },
);

export const approveWarehouseTransferController = AsyncHandler(
  async (req: Request, res: Response) => {
    const id = getParam(req.params.id);

    const transfer = await WarehouseTransferService.approve(id);

    res.status(200).json(
      new ApiResponse(
        "Warehouse transfer approved successfully",
        transfer,
      ),
    );
  },
);

export const dispatchWarehouseTransferController = AsyncHandler(
  async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    const parsed = dispatchWarehouseTransferSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ApiError(400, "Invalid warehouse transfer dispatch data");
    }

    const createdById = req.user?.id;

    if (!createdById) {
      throw new ApiError(401, "Authentication required");
    }

    const transfer = await WarehouseTransferService.dispatch(
      id,
      parsed.data,
      createdById,
    );

    res.status(200).json(
      new ApiResponse(
        "Warehouse transfer dispatched successfully",
        transfer,
      ),
    );
  },
);

export const receiveWarehouseTransferController = AsyncHandler(
  async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    const parsed = receiveWarehouseTransferSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ApiError(400, "Invalid warehouse transfer receipt data");
    }

    const createdById = req.user?.id;

    if (!createdById) {
      throw new ApiError(401, "Authentication required");
    }

    const transfer = await WarehouseTransferService.receive(
      id,
      parsed.data,
      createdById,
    );

    res.status(200).json(
      new ApiResponse(
        "Warehouse transfer receipt recorded successfully",
        transfer,
      ),
    );
  },
);

export const cancelWarehouseTransferController = AsyncHandler(
  async (req: Request, res: Response) => {
    const id = getParam(req.params.id);

    const transfer = await WarehouseTransferService.cancel(id);

    res.status(200).json(
      new ApiResponse(
        "Warehouse transfer cancelled successfully",
        transfer,
      ),
    );
  },
);

