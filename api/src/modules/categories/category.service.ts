import { CategoryRepository } from "./category.repository";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "./category.types";
import ApiError from "../../shared/apiError";
import { Prisma } from "@prisma/client";


const slugify = (value: string) => {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const handleDBError = (error: unknown): never => {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new ApiError(409, "A category with this slug already exists");
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2003"
  ) {
    throw new ApiError(409, "This category is refrenced by other records and cannot be changed or deleted");
  }

  throw error;
};

const validateParent = async (
  parentId: string | null | undefined,
  categoryId?: string,
) => {
  if (!parentId) return;

  if (parentId === categoryId) {
    throw new ApiError(400, "A category cannot be its own parent");
  }

  const parent = await CategoryRepository.findById(parentId);

  if (!parent) {
    throw new ApiError(404, "Parent category not found");
  }

  if (categoryId) {
    let currentParentId: string | null = parentId;

    while (currentParentId) {
      if (currentParentId === categoryId) {
        throw new ApiError(400, "A category cannot be moved beneath its own descendants");
      }

      const currentParent = await CategoryRepository.findById(currentParentId);

      if (!currentParent) break;

      currentParentId = currentParent.parentId;
    }
  }
};

export const CategoryService = {
  async create(input: CreateCategoryInput) {
    const slug = slugify(input.slug ?? input.name);

    if (!slug) {
      throw new ApiError(400, "A valid category slug could not be generated");
    }

    await validateParent(input.parentId);

    try {
      return await CategoryRepository.create({
        name: input.name,
        slug,
        description: input.description,
        parentId: input.parentId,
      });
    } catch (error) {
      handleDBError(error);
    }
  },

  list() {
    return CategoryRepository.findAll();
  },

  async getById(id: string) {
    const category = await CategoryRepository.findById(id);
    if (!category) {
      throw new ApiError(404, "Category not found");
    }

    return category;
  },

  async update(id: string, input: UpdateCategoryInput) {
    const existing = await CategoryRepository.findById(id);

    if (!existing) {
      throw new ApiError(404, "Category not found");
    }

    if (input.parentId !== undefined) {
      await validateParent(input.parentId, id);
    }

    const data = {
      ...input,
      ...(input.slug !== undefined
        ? { slug: slugify(input.slug) }
        : {}),
    };

    if ("slug" in data && !data.slug) {
      throw new ApiError(400, "A valid category slug is required");
    }

    try {
      return await CategoryRepository.update(id, data);
    } catch (error) {
      handleDBError(error);
    }
  },

  async delete(id: string) {
    const category = await CategoryRepository.findById(id);

    if (!category) {
      throw new ApiError(404, "Category not found");
    }

    if (
      category._count.products > 0 ||
      category._count.children > 0
    ) {
      throw new ApiError(
        409,
        "Cannot delete a category that has products or child categories",
      );
    }

    try {
      return await CategoryRepository.delete(id);
    } catch (error) {
      handleDBError(error);
    }
  },

};
