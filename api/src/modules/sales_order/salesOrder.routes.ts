import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { validateBody } from "../../middlewares/validate.middleware";
import {
  createSalesOrderSchema,
  updateSalesOrderSchema,
  confirmSalesOrderSchema,
  cancelSalesOrderSchema,
} from "./salesOrder.types";
import {
  createSalesOrderController,
  listSalesOrdersController,
  getSalesOrderController,
  updateSalesOrderController,
  confirmSalesOrderController,
  cancelSalesOrderController,
} from "./salesOrder.controller";

const router = Router();

router.use(authenticate);

router.post(
  "/",
  validateBody(createSalesOrderSchema, createSalesOrderController),
);

router.get("/", listSalesOrdersController);

router.post(
  "/:id/confirm",
  validateBody(confirmSalesOrderSchema, confirmSalesOrderController),
);

router.post(
  "/:id/cancel",
  validateBody(cancelSalesOrderSchema, cancelSalesOrderController),
);

router.get("/:id", getSalesOrderController);

router.patch(
  "/:id",
  validateBody(updateSalesOrderSchema, updateSalesOrderController),
);

export default router;

