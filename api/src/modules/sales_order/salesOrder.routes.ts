import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { validateBody } from "../../middlewares/validate.middleware";
import {
  createSalesOrderSchema,
  updateSalesOrderSchema,
} from "./salesOrder.types";
import {
  createSalesOrderController,
  listSalesOrdersController,
  getSalesOrderController,
  updateSalesOrderController,
} from "./salesOrder.controller";

const router = Router();

router.use(authenticate);

router.post(
  "/",
  validateBody(createSalesOrderSchema, createSalesOrderController),
);

router.get("/", listSalesOrdersController);

router.get("/:id", getSalesOrderController);

router.patch(
  "/:id",
  validateBody(updateSalesOrderSchema, updateSalesOrderController),
);

export default router;

