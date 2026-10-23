import prisma from "../../prisma/db";
import type {
  CreateProductInput,
  UpdateProductInput,
  ListProductsInput,
} from "./product.types";

const productSelect = {
  id: true,
  sku: true,
  name: true,
  description: true,
  categoryId: true,
  unitPrice: true,
  productStatus: true,
  createdAt: true,
  updatedAt: true,
};

export const ProductRepository = {
  create(data: CreateProductInput) {
    return prisma.product.create({
      data,
      select: {
        ...productSelect,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  },

  findAll(filters: ListProductsInput) {
    const { page, limit, search, categoryId, productStatus } = filters;

    const where = {
      ...(search
        ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { sku: { contains: search, mode: "insensitive" as const } },
          ],
        }
        : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(productStatus ? { productStatus } : {}),
    };

    return prisma.$transaction([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        select: {
          ...productSelect,
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
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
    return prisma.product.findUnique({
      where: { id },
      select: {
        ...productSelect,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  },

  findBySku(sku: string) {
    return prisma.product.findUnique({
      where: { sku },
      select: { id: true },
    });
  },

  findCategoryById(id: string) {
    return prisma.productCategory.findUnique({
      where: { id },
      select: { id: true },
    });
  },

  update(id: string, data: UpdateProductInput) {
    return prisma.product.update({
      where: { id },
      data,
      select: {
        ...productSelect,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  },

  delete(id: string) {
    return prisma.product.delete({
      where: { id },
      select: productSelect,
    });
  },

}
