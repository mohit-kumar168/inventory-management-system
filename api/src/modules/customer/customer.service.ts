import { Prisma } from "@prisma/client";
import { CustomerRepository } from "./customer.repository";
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
  ListCustomersInput,
} from "./customer.types";
import ApiError from "../../shared/apiError";
import logger from "../../config/logger";

const handleDBError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new ApiError(409, "A customer with this email already exists");
    }

    if (error.code === "P2003") {
      throw new ApiError(409, "This customer has related records and cannot be deleted");
    }

    if (error.code === "P2025") {
      throw new ApiError(404, "Customer not found");
    }
  }

  logger.error({ err: error }, "Unexpected customer database error");
  throw error;
}

export const CustomerService = {
  async create(input: CreateCustomerInput) {
    const existingCustomer = await CustomerRepository.findByEmail(input.email);

    if (existingCustomer) {
      throw new ApiError(409, "A Customer with this email already exists");
    }

    try {
      const customer = await CustomerRepository.create(input);

      logger.info(
        { customerId: customer.id },
        "Customer created successfully"
      );
      return customer;
    } catch (error) {
      handleDBError(error);
    }
  },

  async list(filters: ListCustomersInput) {
    const [total, customers] = await CustomerRepository.findAll(filters);

    logger.debug(
      {
        page: filters.page,
        limit: filters.limit,
        resultCount: customers.length,
        total,
      },
      "Customers retrieved"
    );

    return {
      items: customers,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  },

  async getById(id: string) {
    const customer = await CustomerRepository.findById(id);

    if (!customer) {
      logger.warn(
        { customerId: id },
        "Customer lookup failed"
      );
      throw new ApiError(404, "Customer not found");
    }

    return customer;
  },

  async update(id: string, input: UpdateCustomerInput) {
    const existingCustomer = await CustomerRepository.findById(id);

    if (!existingCustomer) {
      throw new ApiError(404, "Customer not found");
    }

    if (input.email !== undefined) {
      const existingEmail = await CustomerRepository.findByEmail(input.email);

      if (existingEmail && existingEmail.id !== id) {
        throw new ApiError(409, "A customer with this email already exists");
      }
    }
    try {
      const customer = await CustomerRepository.update(id, input);

      logger.info(
        {
          customerId: customer.id,
          updatedFields: Object.keys(input),
        },
        "Customer updated successfully"
      );

      return customer;
    } catch (error) {
      handleDBError(error);
    }
  },

  async delete(id: string) {
    const existingCustomer = await CustomerRepository.findById(id);

    if (!existingCustomer) {
      throw new ApiError(404, "Customer not found");
    }

    const hasRelatedRecords =
      existingCustomer._count.addresses > 0 ||
      existingCustomer._count.salesOrders > 0 ||
      existingCustomer._count.returns > 0;

    if (hasRelatedRecords) {
      throw new ApiError(
        409,
        "Cannot delete a customer with related addresses, sales orders, or returns"
      );
    }

    try {
      const customer = await CustomerRepository.delete(id);

      logger.info(
        { customerId: customer.id },
        "Customer deleted successfully"
      );

      return customer;
    } catch (error) {
      handleDBError(error);
    }
  },
};

