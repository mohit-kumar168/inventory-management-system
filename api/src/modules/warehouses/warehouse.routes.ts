
import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { validateBody } from "../../middlewares/validate.middleware";
import {
  createWarehouseSchema,
  updateWarehouseSchema,
} from "./warehouse.types";
import {
  createWarehouseController,
  listWarehousesController,
  getWarehouseController,
  updateWarehouseController,
  deleteWarehouseController,
} from "./warehouse.controller";

const router = Router();

router.use(authenticate);

router.post(
  "/",
  validateBody(createWarehouseSchema, createWarehouseController),
);

router.get("/", listWarehousesController);

router.get("/:id", getWarehouseController);

router.patch(
  "/:id",
  validateBody(updateWarehouseSchema, updateWarehouseController),
);

router.delete("/:id", deleteWarehouseController);

export default router;

