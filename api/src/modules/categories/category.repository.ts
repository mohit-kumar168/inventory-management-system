import prisma from "../../prisma/db";

const categorySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  parentId: true,
  createdAt: true,
  updatedAt: true,
}

export const CategoryRepository = {
  create(data: {
    name: string;
    slug: string;
    description?: string | null;
    parentId?: string | null;
  }) {
    return prisma.productCategory.create({
      data,
      select: categorySelect,
    });
  },

  findAll() {
    return prisma.productCategory.findMany({
      select: {
        ...categorySelect,
        _count: {
          select: {
            products: true,
            children: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });
  },

  findById(id: string) {
    return prisma.productCategory.findUnique({
      where: {
        id
      },
      select: {
        ...categorySelect,
        _count: {
          select: {
            products: true,
            children: true,
          },
        },
      },
    });
  },

  findBySlug(slug: string) {
    return prisma.productCategory.findUnique({
      where: {
        slug,
      },
      select: {
        id: true,
      },
    });
  },


}
