import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { validateBody } from "../../middlewares/validate.middleware";
import {
  createProductSchema,
  updateProductSchema,
} from "./product.types";
import {
  createProductController,
  listProductsController,
  getProductController,
  updateProductController,
  deleteProductController,
} from "./product.controller";

const router = Router();

router.use(authenticate);

router.post(
  "/",
  validateBody(createProductSchema, createProductController),
);

router.get("/", listProductsController);
router.get("/:id", getProductController);

router.patch(
  "/:id",
  validateBody(updateProductSchema, updateProductController),
);

router.delete("/:id", deleteProductController);

export default router;

