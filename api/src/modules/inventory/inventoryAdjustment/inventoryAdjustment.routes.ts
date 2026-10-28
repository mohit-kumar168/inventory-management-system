import { Router } from "express";
import {
  createInventoryAdjustmentController,
  listInventoryAdjustmentsController,
  getInventoryAdjustmentController,
} from "./inventoryAdjustment.controller";
import { authenticate } from "../../../middlewares/auth.middleware";

const router = Router();

router.use(authenticate);

router
  .route("/")
  .get(listInventoryAdjustmentsController)
  .post(createInventoryAdjustmentController);

router.get("/:adjustmentId", getInventoryAdjustmentController);

export default router;

