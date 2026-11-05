import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { validateBody } from "../../middlewares/validate.middleware";
import {
  createGoodsReceiptController,
  listGoodsReceiptsController,
  getGoodsReceiptController,
  updateGoodsReceiptController,
  cancelGoodsReceiptController,
} from "./goodsReceipt.controller";
import {
  createGoodsReceiptSchema,
  updateGoodsReceiptSchema,
} from "./goodsReceipt.types";

const router = Router();

router.use(authenticate);

router.post(
  "/",
  validateBody(createGoodsReceiptSchema, createGoodsReceiptController),
);

router.get("/", listGoodsReceiptsController);

router.get("/:id", getGoodsReceiptController);

router.patch(
  "/:id",
  validateBody(updateGoodsReceiptSchema, updateGoodsReceiptController),
);

router.patch("/:id/cancel", cancelGoodsReceiptController);

export default router;
