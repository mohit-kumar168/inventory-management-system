import prisma from "../../prisma/db";
import type {
  CreateSupplierInput,
  UpdateSupplierInput,
  ListSuppliersInput,
} from "./supplier.types";

const supplierSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  address: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const SupplierRepository = {
  create(data: CreateSupplierInput) {
    return prisma.supplier.create({
      data,
      select: supplierSelect,
    });
  },

  findAll(filters: ListSuppliersInput) {
    const { page, limit, search, status } = filters;

    const where = {
      ...(search
        ? {
          OR: [
            {
              name: {
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
      prisma.supplier.count({ where }),
      prisma.supplier.findMany({
        where,
        select: {
          ...supplierSelect,
          _count: {
            select: {
              purchaseOrders: true,
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
    return prisma.supplier.findUnique({
      where: { id },
      select: {
        ...supplierSelect,
        _count: {
          select: {
            purchaseOrders: true,
          },
        },
      },
    });
  },

  update(id: string, data: UpdateSupplierInput) {
    return prisma.supplier.update({
      where: { id },
      data,
      select: supplierSelect,
    });
  },

  delete(id: string) {
    return prisma.supplier.delete({
      where: { id },
      select: supplierSelect,
    });
  },
};

