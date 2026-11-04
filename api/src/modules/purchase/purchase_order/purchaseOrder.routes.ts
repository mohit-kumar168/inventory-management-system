import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware";
import { validateBody } from "../../../middlewares/validate.middleware";
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
} from "./purchaseOrder.types";
import {
  createPurchaseOrderController,
  listPurchaseOrdersController,
  getPurchaseOrderController,
  updatePurchaseOrderController,
  submitPurchaseOrderController,
  cancelPurchaseOrderController,
} from "./purchaseOrder.controller";

const router = Router();

router.use(authenticate);

router.post(
  "/",
  validateBody(createPurchaseOrderSchema, createPurchaseOrderController),
);

router.get("/", listPurchaseOrdersController);
router.get("/:id", getPurchaseOrderController);

router.patch(
  "/:id",
  validateBody(updatePurchaseOrderSchema, updatePurchaseOrderController),
);

router.patch("/:id/submit", submitPurchaseOrderController);
router.patch("/:id/cancel", cancelPurchaseOrderController);

export default router;
