
import AsyncHandler from "../../shared/asyncHandler";
import ApiResponse from "../../shared/apiResponse";
import { CategoryService } from "./category.service";
import {
  createCategorySchema,
  updateCategorySchema,
} from "./category.types";

export const createCategoryController = AsyncHandler(
  async (req, res) => {
    const data = createCategorySchema.parse(req.body);

    const category = await CategoryService.create(data);

    res.status(201).json(
      new ApiResponse("Category created successfully", category),
    );
  },
);

export const listCategoriesController = AsyncHandler(
  async (req, res) => {
    const categories = await CategoryService.list();

    res.status(200).json(
      new ApiResponse("Categories retrieved successfully", categories),
    );
  },
);

export const getCategoryController = AsyncHandler(
  async (req, res) => {
    const id = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    if (!id) {
      throw new Error("Category ID is required");
    }

    const category = await CategoryService.getById(id);

    res.status(200).json(
      new ApiResponse("Category retrieved successfully", category),
    );
  },
);

export const updateCategoryController = AsyncHandler(
  async (req, res) => {
    const id = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;


    if (!id) {
      throw new Error("Category ID is required");
    }

    const data = updateCategorySchema.parse(req.body);

    const category = await CategoryService.update(id, data);

    res.status(200).json(
      new ApiResponse("Category updated successfully", category),
    );
  },
);

export const deleteCategoryController = AsyncHandler(
  async (req, res) => {
    const id = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;


    if (!id) {
      throw new Error("Category ID is required");
    }

    const category = await CategoryService.delete(id);

    res.status(200).json(
      new ApiResponse("Category deleted successfully", category),
    );
  },
);

