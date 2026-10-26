import { Prisma } from "@prisma/client";
import { SupplierRepository } from "./supplier.repository";
import type {
  CreateSupplierInput,
  UpdateSupplierInput,
  ListSuppliersInput,
} from "./supplier.types";
import ApiError from "../../shared/apiError";
import logger from "../../config/logger";

function handleDBError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2003") {
      logger.warn(
        { code: error.code },
        "Supplier operation rejected: related records exist",
      );

      throw new ApiError(
        409,
        "This supplier has related purchase orders and cannot be deleted",
      );
    }

    if (error.code === "P2025") {
      throw new ApiError(404, "Supplier not found");
    }
  }

  logger.error({ err: error }, "Unexpected supplier database error");
  throw error;
}

export const SupplierService = {
  async create(input: CreateSupplierInput) {
    try {
      const supplier = await SupplierRepository.create(input);

      logger.info(
        { supplierId: supplier.id },
        "Supplier created successfully",
      );

      return supplier;
    } catch (error) {
      handleDBError(error);
    }
  },

  async list(filters: ListSuppliersInput) {
    const [total, suppliers] = await SupplierRepository.findAll(filters);

    logger.debug(
      {
        page: filters.page,
        limit: filters.limit,
        resultCount: suppliers.length,
        total,
      },
      "Suppliers retrieved",
    );

    return {
      items: suppliers,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  },

  async getById(id: string) {
    const supplier = await SupplierRepository.findById(id);

    if (!supplier) {
      logger.warn({ supplierId: id }, "Supplier lookup failed");
      throw new ApiError(404, "Supplier not found");
    }

    return supplier;
  },

  async update(id: string, input: UpdateSupplierInput) {
    const existingSupplier = await SupplierRepository.findById(id);

    if (!existingSupplier) {
      logger.warn(
        { supplierId: id },
        "Supplier update rejected: not found",
      );

      throw new ApiError(404, "Supplier not found");
    }

    try {
      const supplier = await SupplierRepository.update(id, input);

      logger.info(
        {
          supplierId: supplier.id,
          updatedFields: Object.keys(input),
        },
        "Supplier updated successfully",
      );

      return supplier;
    } catch (error) {
      handleDBError(error);
    }
  },

  async delete(id: string) {
    const existingSupplier = await SupplierRepository.findById(id);

    if (!existingSupplier) {
      logger.warn(
        { supplierId: id },
        "Supplier deletion rejected: not found",
      );

      throw new ApiError(404, "Supplier not found");
    }

    if (existingSupplier._count.purchaseOrders > 0) {
      logger.warn(
        {
          supplierId: id,
          purchaseOrderCount: existingSupplier._count.purchaseOrders,
        },
        "Supplier deletion rejected: purchase orders exist",
      );

      throw new ApiError(
        409,
        "Cannot delete a supplier that has purchase orders",
      );
    }

    try {
      const supplier = await SupplierRepository.delete(id);

      logger.info(
        { supplierId: supplier.id },
        "Supplier deleted successfully",
      );

      return supplier;
    } catch (error) {
      handleDBError(error);
    }
  },
};

