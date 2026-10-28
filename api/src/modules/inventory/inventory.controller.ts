import type { Request, Response } from "express";
import AsyncHandler from "../../shared/asyncHandler";
import ApiResponse from "../../shared/apiResponse";
import ApiError from "../../shared/apiError";
import { InventoryService } from "./inventory.service";
import {
  listInventoryBalancesSchema,
  reconciliationSchema,
} from "./inventory.types";

const getParam = (value: string | string[] | undefined): string => {
  const result = Array.isArray(value) ? value[0] : value;

  if (!result) {
    throw new ApiError(400, "Required route parameter is missing");
  }

  return result;
};

export const listInventoryBalancesController = AsyncHandler(
  async (req: Request, res: Response) => {
    const parsed = listInventoryBalancesSchema.safeParse(req.query);

    if (!parsed.success) {
      throw new ApiError(400, "Invalid inventory query parameters");
    }

    const result = await InventoryService.listBalances(parsed.data);

    res.status(200).json(
      new ApiResponse(
        "Inventory balances retrieved successfully",
        {
          items: result.items,
          meta: result.meta
        },
      ),
    );
  },
);

export const getInventoryBalanceController = AsyncHandler(
  async (req: Request, res: Response) => {
    const id = getParam(req.params.balanceId);
    const balance = await InventoryService.getBalance(id);

    res.status(200).json(
      new ApiResponse(
        "Inventory balance retrieved successfully",
        balance,
      ));
  },
);

export const getProductInventoryController = AsyncHandler(
  async (req: Request, res: Response) => {
    const productId = getParam(req.params.productId);
    const result = await InventoryService.getProductInventory(productId);

    res.status(200).json(
      new ApiResponse(
        "Product inventory retrieved successfully",
        result,
      ),
    );
  },
);

export const reconcileInventoryController = AsyncHandler(
  async (req: Request, res: Response) => {
    const parsed = reconciliationSchema.safeParse(req.query);

    if (!parsed.success) {
      throw new ApiError(400, "Invalid reconciliation query parameters");
    }

    const result = await InventoryService.reconcile(parsed.data);

    res
      .status(200)
      .json(new ApiResponse("Inventory reconciliation completed", result));
  },
);

