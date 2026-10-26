
import { Prisma } from "@prisma/client";
import { WarehouseRepository } from "./warehouse.repository";
import type {
  CreateWarehouseInput,
  UpdateWarehouseInput,
  ListWarehousesInput,
} from "./warehouse.types";
import ApiError from "../../shared/apiError";
import logger from "../../config/logger";

const handleDBError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      logger.warn(
        { code: error.code },
        "Warehouse operation rejected: duplicate warehouse code",
      );
      throw new ApiError(409, "A warehouse with this code already exists");
    }

    if (error.code === "P2003") {
      logger.warn(
        { code: error.code },
        "Warehouse operation rejected: related records exist",
      );
      throw new ApiError(
        409,
        "This warehouse has related records and cannot be deleted",
      );
    }

    if (error.code === "P2025") {
      throw new ApiError(404, "Warehouse not found");
    }
  }

  logger.error({ err: error }, "Unexpected warehouse database error");
  throw error;
}

export const WarehouseService = {
  async create(input: CreateWarehouseInput) {
    const existingWarehouse = await WarehouseRepository.findByCode(input.code);

    if (existingWarehouse) {
      logger.warn(
        { code: input.code },
        "Warehouse creation rejected: duplicate code",
      );
      throw new ApiError(409, "A warehouse with this code already exists");
    }

    try {
      const warehouse = await WarehouseRepository.create(input);

      logger.info(
        { warehouseId: warehouse.id, code: warehouse.code },
        "Warehouse created successfully",
      );

      return warehouse;
    } catch (error) {
      handleDBError(error);
    }
  },

  async list(filters: ListWarehousesInput) {
    const [total, warehouses] = await WarehouseRepository.findAll(filters);

    logger.debug(
      {
        page: filters.page,
        limit: filters.limit,
        resultCount: warehouses.length,
        total,
      },
      "Warehouses retrieved",
    );

    return {
      items: warehouses,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  },

  async getById(id: string) {
    const warehouse = await WarehouseRepository.findById(id);

    if (!warehouse) {
      logger.warn({ warehouseId: id }, "Warehouse lookup failed");
      throw new ApiError(404, "Warehouse not found");
    }

    return warehouse;
  },

  async update(id: string, input: UpdateWarehouseInput) {
    const existingWarehouse = await WarehouseRepository.findById(id);

    if (!existingWarehouse) {
      logger.warn(
        { warehouseId: id },
        "Warehouse update rejected: not found",
      );
      throw new ApiError(404, "Warehouse not found");
    }

    if (input.code !== undefined) {
      const existingCode = await WarehouseRepository.findByCode(input.code);

      if (existingCode && existingCode.id !== id) {
        logger.warn(
          { warehouseId: id, code: input.code },
          "Warehouse update rejected: duplicate code",
        );
        throw new ApiError(409, "A warehouse with this code already exists");
      }
    }

    try {
      const warehouse = await WarehouseRepository.update(id, input);

      logger.info(
        {
          warehouseId: warehouse.id,
          updatedFields: Object.keys(input),
        },
        "Warehouse updated successfully",
      );

      return warehouse;
    } catch (error) {
      handleDBError(error);
    }
  },

  async delete(id: string) {
    const existingWarehouse = await WarehouseRepository.findById(id);

    if (!existingWarehouse) {
      logger.warn(
        { warehouseId: id },
        "Warehouse deletion rejected: not found",
      );
      throw new ApiError(404, "Warehouse not found");
    }

    const counts = existingWarehouse._count;

    const hasRelatedRecords = Object.values(counts).some(
      (count) => count > 0,
    );

    if (hasRelatedRecords) {
      logger.warn(
        { warehouseId: id, counts },
        "Warehouse deletion rejected: related records exist",
      );

      throw new ApiError(
        409,
        "Cannot delete a warehouse that has related inventory or transaction records",
      );
    }

    try {
      const warehouse = await WarehouseRepository.delete(id);

      logger.info(
        { warehouseId: warehouse.id, code: warehouse.code },
        "Warehouse deleted successfully",
      );

      return warehouse;
    } catch (error) {
      handleDBError(error);
    }
  },
};

