import { Prisma } from "@prisma/client";
import { ProductRepository } from "./product.repository";
import type {
  CreateProductInput,
  UpdateProductInput,
  ListProductsInput,
} from "./product.types";
import ApiError from "../../shared/apiError";
import logger from "../../config/logger";

const handleDBError = (error: unknown): never => {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError
  ) {
    if (error.code === "P2002") {
      logger.warn(
        { code: error.code },
        "Product operation rejected: duplicate unique value",
      );

      throw new ApiError(409, "A product with this SKU already exists");
    }

    if (error.code === "P2025") {
      throw new ApiError(404, "Product not found");
    }
  }

  logger.error({ err: error }, "Unexpected proudct database error");
  throw error;
};

export const ProductService = {
  async create(input: CreateProductInput) {
    const category = await ProductRepository.findCategoryById(input.categoryId);

    if (!category) {
      logger.warn(
        { categoryId: input.categoryId },
        "Product creation rejected category not found",
      );

      throw new ApiError(404, "Category not found");
    }

    const existingProduct = await ProductRepository.findBySku(input.sku);

    if (existingProduct) {
      logger.warn(
        { sku: input.sku },
        "Product creation rejected: duplicated SKU",
      );

      throw new ApiError(409, "A product with this SKU already exists")
    }

    try {
      const product = await ProductRepository.create(input);

      logger.info(
        {
          productId: product.id,
          sku: product.sku,
          categoryId: product.categoryId,
        },
        "Product created successfully",
      );

      return product;
    } catch (error) {
      handleDBError(error);
    }
  },

  async list(filters: ListProductsInput) {
    const [total, products] = await ProductRepository.findAll(filters);

    logger.debug(
      {
        page: filters.page,
        limit: filters.limit,
        resultCount: products.length,
        total,
      },
      "Products retrieved",
    );

    return {
      items: products,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  },

  async getById(id: string) {
    const product = await ProductRepository.findById(id);

    if (!product) {
      logger.warn({ productId: id }, "Product lookup failed");
      throw new ApiError(404, "Product not found");
    }

    return product;
  },

  async update(id: string, input: UpdateProductInput) {
    const existingProduct = await ProductRepository.findById(id);

    if (!existingProduct) {
      logger.warn({ productId: id }, "Product update rejected: not found");
      throw new ApiError(404, "Product not found");
    }

    if (input.categoryId !== undefined) {
      const category = await ProductRepository.findCategoryById(input.categoryId);

      if (!category) {
        throw new ApiError(404, "Category not found");
      }
    }

    if (input.sku !== undefined) {
      const existingSku = await ProductRepository.findBySku(input.sku);

      if (existingSku && existingSku.id !== id) {
        logger.warn(
          { productId: id, sku: input.sku },
          "Product update rejected: duplicate SKU",
        );

        throw new ApiError(409, "A product with this SKU already exists");
      }
    }

    try {
      const product = await ProductRepository.update(id, input);

      logger.info(
        {
          productId: product.id,
          updateFields: Object.keys(input),
        },
        "Product updated successfully",
      );

      return product;
    } catch (error) {
      handleDBError(error);
    }
  },

  async delete(id: string) {
    const existingProduct = await ProductRepository.findById(id);

    if (!existingProduct) {
      logger.warn(
        { productId: id },
        "Product deletioin rejected: not found",
      );

      throw new ApiError(404, "Product not found");
    }

    try {
      const product = await ProductRepository.delete(id);

      logger.info(
        { productId: id, sku: product.sku },
        "Product deleted successfully",
      );

      return product;
    } catch (error) {
      handleDBError(error);
    }
  },

};
