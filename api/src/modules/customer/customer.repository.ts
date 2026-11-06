import prisma from "../../prisma/db";
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
  ListCustomersInput,
} from "./customer.types";

const customerSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  status: true,
  createdAt: true,
  updatedAt: true,
};

export const CustomerRepository = {
  create(data: CreateCustomerInput) {
    return prisma.customer.create({
      data,
      select: customerSelect,
    });
  },

  findAll(filters: ListCustomersInput) {
    const { page, limit, search, status } = filters;

    const where = {
      ...(search
        ? {
          OR: [
            {
              firstName: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            {
              lastName: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            {
              email: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            {
              phone: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
          ],
        }
        : {}),
      ...(status ? { status } : {}),
    };
    return prisma.$transaction([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        select: {
          ...customerSelect,
          _count: {
            select: {
              addresses: true,
              salesOrders: true,
              returns: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
  },

  findById(id: string) {
    return prisma.customer.findUnique({
      where: { id },
      select: {
        ...customerSelect,
        _count: {
          select: {
            addresses: true,
            salesOrders: true,
            returns: true,
          },
        },
      },
    });
  },

  findByEmail(email: string) {
    return prisma.customer.findUnique({
      where: { email },
      select: { id: true },
    });
  },

  update(id: string, data: UpdateCustomerInput) {
    return prisma.customer.update({
      where: { id },
      data,
      select: customerSelect,
    });
  },

  delete(id: string) {
    return prisma.customer.delete({
      where: { id },
      select: customerSelect,
    });
  },

};
