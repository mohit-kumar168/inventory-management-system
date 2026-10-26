import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { validateBody } from "../../middlewares/validate.middleware";
import {
  createSupplierSchema,
  updateSupplierSchema,
} from "./supplier.types";
import {
  createSupplierController,
  listSuppliersController,
  getSupplierController,
  updateSupplierController,
  deleteSupplierController,
} from "./supplier.controller";

const router = Router();

router.use(authenticate);

router.post(
  "/",
  validateBody(createSupplierSchema, createSupplierController)
);

router.get("/", listSuppliersController);
router.get("/:id", getSupplierController);

router.patch(
  "/:id",
  validateBody(updateSupplierSchema, updateSupplierController)
);

router.delete("/:id", deleteSupplierController);

export default router;

