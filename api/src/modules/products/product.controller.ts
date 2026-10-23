
import AsyncHandler from "../../shared/asyncHandler";
import ApiResponse from "../../shared/apiResponse";
import ApiError from "../../shared/apiError";
import { ProductService } from "./product.service";
import {
  listProductsSchema,
} from "./product.types";
import type {
  CreateProductInput,
  UpdateProductInput,
} from "./product.types";

export const createProductController = AsyncHandler(
  async (req, res) => {
    const product = await ProductService.create(
      req.body as CreateProductInput,
    );

    res.status(201).json(
      new ApiResponse("Product created successfully", product),
    );
  },
);

export const listProductsController = AsyncHandler(
  async (req, res) => {
    const parsed = listProductsSchema.safeParse(req.query);

    if (!parsed.success) {
      throw new ApiError(400, "Invalid product query parameters");
    }

    const result = await ProductService.list(parsed.data);

    res.status(200).json(
      new ApiResponse("Products retrieved successfully", result),
    );
  },
);

export const getProductController = AsyncHandler(
  async (req, res) => {
    const id = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    if (!id) {
      throw new ApiError(400, "Product ID is required");
    }

    const product = await ProductService.getById(id);

    res.status(200).json(
      new ApiResponse("Product retrieved successfully", product),
    );
  },
);

export const updateProductController = AsyncHandler(
  async (req, res) => {
    const id = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    if (!id) {
      throw new ApiError(400, "Product ID is required");
    }

    const product = await ProductService.update(
      id,
      req.body as UpdateProductInput,
    );

    res.status(200).json(
      new ApiResponse("Product updated successfully", product),
    );
  },
);

export const deleteProductController = AsyncHandler(
  async (req, res) => {
    const id = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    if (!id) {
      throw new ApiError(400, "Product ID is required");
    }

    const product = await ProductService.delete(id);

    res.status(200).json(
      new ApiResponse("Product deleted successfully", product),
    );
  },
);

