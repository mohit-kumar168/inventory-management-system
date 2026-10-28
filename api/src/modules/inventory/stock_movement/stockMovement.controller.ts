import type { Request, Response, NextFunction } from "express";
import { stockMovementService } from "./stockMovement.service";
import { listStockMovementSchema } from "./stockMovement.types";

export const listStockMovementsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const filters = listStockMovementSchema.parse(req.query);
    const result = await stockMovementService.list(filters);

    res.status(200).json({
      success: true,
      data: result.items,
      pagination: {
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getStockMovementByIdController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const movementId = req.params.movementId as string;

    const movement = await stockMovementService.getById(movementId);

    res.status(200).json({
      success: true,
      data: movement,
    });
  } catch (error) {
    next(error);
  }
};
