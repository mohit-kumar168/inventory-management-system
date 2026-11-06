import { Prisma } from "@prisma/client";
import prisma from "../../../prisma/db";
import ApiError from "../../../shared/apiError";
import logger from "../../../config/logger";
import { AddressRepository } from "./address.repository";
import type {
  CreateAddressInput,
  UpdateAddressInput,
} from "./address.types";

async function ensureCustomerExists(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true },
  });

  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }
}

async function ensureAddressExists(
  customerId: string,
  addressId: string,
) {
  const address = await AddressRepository.findById(
    customerId,
    addressId,
  );

  if (!address) {
    throw new ApiError(404, "Customer address not found");
  }

  return address;
}

function handleDBError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2003") {
      throw new ApiError(
        409,
        "This address is referenced by a sales order and cannot be deleted",
      );
    }

    if (error.code === "P2025") {
      throw new ApiError(404, "Customer address not found");
    }
  }

  logger.error({ err: error }, "Customer address database error");
  throw error;
}

export const AddressService = {
  async create(customerId: string, input: CreateAddressInput) {
    await ensureCustomerExists(customerId);

    try {
      const addresses = await AddressRepository.findAll(customerId);
      const data = {
        ...input,
        isDefault: input.isDefault ?? addresses.length === 0,
      };

      const address = await AddressRepository.createDefault(
        customerId,
        data,
      );

      logger.info(
        { customerId, addressId: address.id },
        "Customer address created",
      );

      return address;
    } catch (error) {
      handleDBError(error);
    }
  },

  async list(customerId: string) {
    await ensureCustomerExists(customerId);
    return AddressRepository.findAll(customerId);
  },

  async getById(customerId: string, addressId: string) {
    await ensureAddressExists(customerId, addressId);
    return AddressRepository.findById(customerId, addressId);
  },

  async update(
    customerId: string,
    addressId: string,
    input: UpdateAddressInput,
  ) {
    await ensureAddressExists(customerId, addressId);

    try {
      const address = await AddressRepository.update(
        customerId,
        addressId,
        input,
      );

      logger.info(
        { customerId, addressId },
        "Customer address updated",
      );

      return address;
    } catch (error) {
      handleDBError(error);
    }
  },

  async delete(customerId: string, addressId: string) {
    const address = await ensureAddressExists(customerId, addressId);

    if (address._count.salesOrders > 0) {
      throw new ApiError(
        409,
        "Cannot delete an address referenced by sales orders",
      );
    }

    try {
      const deleted = await AddressRepository.delete(addressId);

      logger.info(
        { customerId, addressId },
        "Customer address deleted",
      );

      return deleted;
    } catch (error) {
      handleDBError(error);
    }
  },
};

