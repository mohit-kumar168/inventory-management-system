import { Router } from "express";
import {
  listStockMovementsController,
  getStockMovementByIdController,
} from "./stockMovement.controller";

const router = Router();

router.get("/", listStockMovementsController);
router.get("/:movementId", getStockMovementByIdController);

export default router;
