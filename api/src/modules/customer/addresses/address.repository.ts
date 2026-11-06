import prisma from "../../../prisma/db";
import type {
  CreateAddressInput,
  UpdateAddressInput,
} from "./address.types";

const addressSelect = {
  id: true,
  customerId: true,
  label: true,
  recipientName: true,
  phone: true,
  line1: true,
  line2: true,
  city: true,
  state: true,
  postalCode: true,
  country: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const AddressRepository = {
  create(customerId: string, data: CreateAddressInput) {
    return prisma.customerAddress.create({
      data: {
        ...data,
        customerId,
      },
      select: addressSelect,
    });
  },

  findAll(customerId: string) {
    return prisma.customerAddress.findMany({
      where: { customerId },
      select: addressSelect,
      orderBy: [
        { isDefault: "desc" },
        { createdAt: "desc" },
      ],
    });
  },

  findById(customerId: string, addressId: string) {
    return prisma.customerAddress.findFirst({
      where: {
        id: addressId,
        customerId,
      },
      select: {
        ...addressSelect,
        _count: {
          select: { salesOrders: true },
        },
      },
    });
  },

  async createDefault(customerId: string, data: CreateAddressInput) {
    return prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.customerAddress.updateMany({
          where: { customerId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.customerAddress.create({
        data: { ...data, customerId },
        select: addressSelect,
      });
    });
  },

  async update(
    customerId: string,
    addressId: string,
    data: UpdateAddressInput,
  ) {
    return prisma.$transaction(async (tx) => {
      if (data.isDefault === true) {
        await tx.customerAddress.updateMany({
          where: {
            customerId,
            isDefault: true,
            NOT: { id: addressId },
          },
          data: { isDefault: false },
        });
      }

      return tx.customerAddress.update({
        where: { id: addressId },
        data,
        select: addressSelect,
      });
    });
  },

  delete(addressId: string) {
    return prisma.customerAddress.delete({
      where: { id: addressId },
      select: addressSelect,
    });
  },
};

