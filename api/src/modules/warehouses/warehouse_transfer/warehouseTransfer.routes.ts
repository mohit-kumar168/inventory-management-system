import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware";
import {
  createWarehouseTransferController,
  listWarehouseTransfersController,
  getWarehouseTransferController,
  updateWarehouseTransferController,
  submitWarehouseTransferController,
  approveWarehouseTransferController,
  dispatchWarehouseTransferController,
  receiveWarehouseTransferController,
  cancelWarehouseTransferController,
} from "./warehouseTransfer.controller";

const router = Router();

router.use(authenticate);

router
  .route("/")
  .get(listWarehouseTransfersController)
  .post(createWarehouseTransferController);

router.get("/:id", getWarehouseTransferController);

router.patch("/:id", updateWarehouseTransferController);

router.post("/:id/submit-for-approval", submitWarehouseTransferController);

router.post("/:id/approve", approveWarehouseTransferController);

router.post("/:id/dispatch", dispatchWarehouseTransferController);

router.post("/:id/receive", receiveWarehouseTransferController);

router.post("/:id/cancel", cancelWarehouseTransferController);

export default router;

