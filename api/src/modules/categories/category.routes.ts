
import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { validateBody } from "../../middlewares/validate.middleware";

import {
  createCategorySchema,
  updateCategorySchema,
} from "./category.types";

import {
  createCategoryController,
  listCategoriesController,
  getCategoryController,
  updateCategoryController,
  deleteCategoryController,
} from "./category.controller";

const router = Router();

router.use(authenticate);

router.post(
  "/",
  validateBody(createCategorySchema, createCategoryController),
);

router.get("/", listCategoriesController);

router.get("/:id", getCategoryController);

router.patch(
  "/:id",
  validateBody(updateCategorySchema, updateCategoryController),
);

router.delete("/:id", deleteCategoryController);

export default router;

