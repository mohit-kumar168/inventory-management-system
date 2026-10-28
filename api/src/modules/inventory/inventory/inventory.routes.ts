import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware";
import {
  listInventoryBalancesController,
  getInventoryBalanceController,
  reconcileInventoryController,
} from "./inventory.controller";
import inventoryAdjustmentRoutes from "../inventoryAdjustment/inventoryAdjustment.routes";
import stockMovementRoutes from "../stock_movement/stockMovement.routes";

const router = Router();

router.use(authenticate);

router.use("/api/v1/inventory-adjustments", inventoryAdjustmentRoutes);

router.use("/movements", stockMovementRoutes);

router.get("/balances", listInventoryBalancesController);
router.get("/balances/:balanceId", getInventoryBalanceController);
router.get("/reconciliation", reconcileInventoryController);

export default router;

