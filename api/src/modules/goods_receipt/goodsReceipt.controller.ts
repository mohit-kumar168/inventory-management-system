import AsyncHandler from "../../shared/asyncHandler";
import ApiResponse from "../../shared/apiResponse";
import ApiError from "../../shared/apiError";
import { GoodsReceiptService } from "./goodsReceipt.service";
import {
  createGoodsReceiptSchema,
  updateGoodsReceiptSchema,
  listGoodsReceiptsSchema,
} from "./goodsReceipt.types";
import type {
  CreateGoodsReceiptInput,
  UpdateGoodsReceiptInput,
  ListGoodsReceiptsInput,
} from "./goodsReceipt.types";

const getGoodsReceiptId = (id: string | string[] | undefined): string => {
  const receiptId = Array.isArray(id) ? id[0] : id;

  if (!receiptId) {
    throw new ApiError(400, "Goods receipt ID is required");
  }

  return receiptId;
};

export const createGoodsReceiptController = AsyncHandler(async (req, res) => {
  const parsed = createGoodsReceiptSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ApiError(
      400,
      parsed.error.issues[0]?.message || "Invalid goods receipt data",
    );
  }

  const goodsReceipt = await GoodsReceiptService.create(
    parsed.data as CreateGoodsReceiptInput,
    req.user?.id!,
  );

  res
    .status(201)
    .json(
      new ApiResponse(
        "Goods receipt created successfully",
        goodsReceipt,
      ),
    );
});

export const listGoodsReceiptsController = AsyncHandler(async (req, res) => {
  const parsed = listGoodsReceiptsSchema.safeParse(req.query);

  if (!parsed.success) {
    throw new ApiError(
      400,
      parsed.error.issues[0]?.message || "Invalid query parameters",
    );
  }

  const goodsReceipts = await GoodsReceiptService.list(
    parsed.data as ListGoodsReceiptsInput,
  );

  res
    .status(200)
    .json(
      new ApiResponse(
        "Goods receipts fetched successfully",
        goodsReceipts,
      ),
    );
});

export const getGoodsReceiptController = AsyncHandler(async (req, res) => {
  const id = getGoodsReceiptId(req.params.id);

  const goodsReceipt = await GoodsReceiptService.getById(id);

  res
    .status(200)
    .json(
      new ApiResponse(
        "Goods receipt fetched successfully",
        goodsReceipt,
      ),
    );
});

export const updateGoodsReceiptController = AsyncHandler(async (req, res) => {
  const parsed = updateGoodsReceiptSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ApiError(
      400,
      parsed.error.issues[0]?.message || "Invalid goods receipt data",
    );
  }

  const id = getGoodsReceiptId(req.params.id);

  const goodsReceipt = await GoodsReceiptService.update(
    id,
    parsed.data as UpdateGoodsReceiptInput,
  );

  res
    .status(200)
    .json(
      new ApiResponse(
        "Goods receipt updated successfully",
        goodsReceipt,
      ),
    );
});

export const postGoodsReceiptController = AsyncHandler(
  async (req, res) => {
    const id = getGoodsReceiptId(req.params.id);

    const goodsReceipt = await GoodsReceiptService.post(id);

    res
      .status(200)
      .json(
        new ApiResponse(
          "Goods receipt posted successfully",
          goodsReceipt,
        ),
      );
  },
);

export const cancelGoodsReceiptController = AsyncHandler(async (req, res) => {
  const id = getGoodsReceiptId(req.params.id);

  const goodsReceipt = await GoodsReceiptService.cancel(id);

  res
    .status(200)
    .json(
      new ApiResponse(
        "Goods receipt cancelled successfully",
        goodsReceipt,
      ),
    );
});
