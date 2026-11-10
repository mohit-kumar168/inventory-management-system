import { Prisma, CustomerStatus, ProductStatus, PaymentStatus } from "@prisma/client";
import prisma from "../../prisma/db";
import type {
  CreateSalesOrderInput,
  UpdateSalesOrderInput,
  ListSalesOrdersInput
} from "./salesOrder.types";

const salesOrderSelect = {
  id: true,
  orderNo: true,
  customerId: true,
  status: true,
  paymentStatus: true,
  fulfillmentStatus: true,
  shippingAddressId: true,
  shippingRecientName: true,
  shippingPhone: true,
  shippingLine1: true,
  shippingLine2: true,
  shippingCity: true,
  shippingState: true,
  shippingPostalCode: true,
  shippingCountry: true,
  subtotal: true,
  discountAmount: true,
  shippingAmount: true,
  totalAmount: true,
  currency: true,
  notes: true,
  cancellationReason: true,
  createdById: true,
  updatedAt: true,

  customer: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      status: true,
    }
  },

  createdBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },

  items: {
    select: {
      id: true,
      productId: true,
      productNameSnapshot: true,
      skuSnapshot: true,
      quantitiy: true,
      unitPrice: true,
      discountAmount: true,
      lineTotal: true,
      product: {
        select: {
          id: true,
          sku: true,
          name: true,
          unitPrice: true,
          productStatus: true,
        },
      },
    },
  },
};


function calculateLineTotal(
  quantity: number,
  unitPrice: number,
  discountAmount: number,
) {
  return quantity * unitPrice - discountAmount;
}

function calculateTotal(
  subtotal: number,
  discountAmount: number,
  shippingAmount: number,
) {
  return subtotal - discountAmount + shippingAmount;
}

function getAddressSnapshot(
  address: NonNullable<CreateSalesOrderInput["shippingAddress"]>,
) {
  return {
    shippingRecipientName: address.recipientName,
    shippingPhone: address.phone,
    shippingLine1: address.addressLine1,
    shippingLine2: address.addressLine2,
    shippingCity: address.city,
    shippingState: address.state,
    shippingPostalCode: address.postalCode,
    shippingCountry: address.country,
  };
}

export const SalesOrderRepository = {
  async create(
    data: CreateSalesOrderInput,
    createdById: string,
    orderNo: string,
    idempotencyKey: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: data.customerId },
        select: {
          id: true,
          status: true,
        },
      });

      if (!customer) {
        throw new Error("Customer not found");
      }

      if (customer.status !== CustomerStatus.ACTIVE) {
        throw new Error("Customer is inactive");
      }

      let addressSnapshot = {};
      let shippingAddressId: string | null = null;

      if (data.shippingAddressId) {
        const address = await tx.customerAddress.findFirst({
          where: {
            id: data.shippingAddressId,
            customerId: data.customerId,
          },
        });

        if (!address) {
          throw new Error("Shipping address not found for this customer");
        }

        shippingAddressId = address.id;

        addressSnapshot = {
          shippingRecipientName: address.recipientName,
          shippingPhone: address.phone,
          shippingLine1: address.line1,
          shippingLine2: address.line2,
          shippingCity: address.city,
          shippingState: address.state,
          shippingPostalCode: address.postalCode,
          shippingCountry: address.country,
        };
      } else if (data.shippingAddress) {
        addressSnapshot = getAddressSnapshot(data.shippingAddress);
      }

      const products = await tx.product.findMany({
        where: {
          id: {
            in: data.items.map((item) => item.productId),
          },
        },
        select: {
          id: true,
          sku: true,
          name: true,
          unitPrice: true,
          productStatus: true,
        },
      });

      if (products.length !== data.items.length) {
        throw new Error("One or more products were not found");
      }

      const productMap = new Map(
        products.map((product) => [product.id, product]),
      );

      let subtotal = 0;

      const orderItems = data.items.map((item) => {
        const product = productMap.get(item.productId);

        if (!product) {
          throw new Error("Product not found");
        }

        if (product.productStatus !== ProductStatus.ACTIVE) {
          throw new Error(`Product ${product.sku} is inactive`);
        }

        const discountAmount = item.discountAmount ?? 0;
        const lineSubtotal = item.quantity * product.unitPrice;

        if (discountAmount > lineSubtotal) {
          throw new Error(
            `Discount exceeds the amount for product ${product.sku}`,
          );
        }

        const lineTotal = calculateLineTotal(
          item.quantity,
          product.unitPrice,
          discountAmount,
        );

        subtotal += lineTotal;

        return {
          productId: product.id,
          productNameSnapshot: product.name,
          skuSnapshot: product.sku,
          quantity: item.quantity,
          unitPrice: product.unitPrice,
          discountAmount,
          lineTotal,
        };
      });

      const discountAmount = data.discountAmount ?? 0;
      const shippingAmount = data.shippingAmount ?? 0;

      if (discountAmount > subtotal) {
        throw new Error("Order discount exceeds subtotal");
      }

      const totalAmount = calculateTotal(
        subtotal,
        discountAmount,
        shippingAmount,
      );

      return tx.salesOrder.create({
        data: {
          orderNo,
          customerId: data.customerId,
          createdById,
          idempotencyKey,
          shippingAddressId,
          ...addressSnapshot,
          subtotal,
          discountAmount,
          shippingAmount,
          totalAmount,
          notes: data.notes,
          items: {
            create: orderItems,
          },
        },
        select: salesOrderSelect,
      });
    });
  },

  findByIdempotencyKey(idempotencyKey: string) {
    return prisma.salesOrder.findUnique({
      where: { idempotencyKey },
      select: salesOrderSelect,
    });
  },

  findAll(filters: ListSalesOrdersInput) {
    const {
      page,
      limit,
      customerId,
      status,
      paymentStatus,
      fulfillmentStatus,
      search,
      createdFrom,
      createdTo,
    } = filters;

    const where: Prisma.SalesOrderWhereInput = {
      ...(customerId ? { customerId } : {}),
      ...(status ? { status } : {}),
      ...(paymentStatus ? { paymentStatus } : {}),
      ...(fulfillmentStatus ? { fulfillmentStatus } : {}),

      ...(search
        ? {
          OR: [
            {
              orderNo: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              customer: {
                email: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
            {
              customer: {
                firstName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
            {
              customer: {
                lastName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
          ],
        }
        : {}),

      ...(createdFrom || createdTo
        ? {
          createdAt: {
            ...(createdFrom ? { gte: createdFrom } : {}),
            ...(createdTo ? { lte: createdTo } : {}),
          },
        }
        : {}),
    };

    return prisma.$transaction([
      prisma.salesOrder.count({ where }),

      prisma.salesOrder.findMany({
        where,
        select: salesOrderSelect,
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
  },

  findById(id: string) {
    return prisma.salesOrder.findUnique({
      where: { id },
      select: salesOrderSelect,
    });
  },

  async update(
    id: string,
    data: UpdateSalesOrderInput,
  ) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.salesOrder.findUnique({
        where: { id },
        select: {
          status: true,
          customerId: true,
          subtotal: true,
          discountAmount: true,
          shippingAmount: true,
        },
      });

      if (!existing) {
        throw new Error("Sales order not found");
      }

      if (existing.status !== "DRAFT") {
        throw new Error("Only draft sales orders can be updated");
      }

      const updateData: Prisma.SalesOrderUpdateInput = {};

      if (data.customerId) {
        const customer = await tx.customer.findUnique({
          where: { id: data.customerId },
          select: {
            id: true,
            status: true,
          },
        });

        if (!customer) {
          throw new Error("Customer not found");
        }

        if (customer.status !== CustomerStatus.ACTIVE) {
          throw new Error("Customer is inactive");
        }

        updateData.customer = {
          connect: { id: data.customerId },
        };
      }

      if (data.shippingAddressId) {
        const address = await tx.customerAddress.findFirst({
          where: {
            id: data.shippingAddressId,
            customerId: data.customerId ?? existing.customerId,
          },
        });

        if (!address) {
          throw new Error("Shipping address not found for this customer");
        }

        updateData.shippingAddress = {
          connect: { id: address.id },
        };

        Object.assign(updateData, {
          shippingRecipientName: address.recipientName,
          shippingPhone: address.phone,
          shippingLine1: address.line1,
          shippingLine2: address.line2,
          shippingCity: address.city,
          shippingState: address.state,
          shippingPostalCode: address.postalCode,
          shippingCountry: address.country,
        });
      } else if (data.shippingAddress) {
        updateData.shippingAddress = {
          disconnect: true,
        };

        Object.assign(
          updateData,
          getAddressSnapshot(data.shippingAddress),
        );
      }

      let subtotal = existing.subtotal;

      if (data.items) {
        const products = await tx.product.findMany({
          where: {
            id: {
              in: data.items.map((item) => item.productId),
            },
          },
          select: {
            id: true,
            sku: true,
            name: true,
            unitPrice: true,
            productStatus: true,
          },
        });

        if (products.length !== data.items.length) {
          throw new Error("One or more products were not found");
        }

        const productMap = new Map(
          products.map((product) => [product.id, product]),
        );

        const orderItems = data.items.map((item) => {
          const product = productMap.get(item.productId);

          if (!product) {
            throw new Error("Product not found");
          }

          if (product.productStatus !== ProductStatus.ACTIVE) {
            throw new Error(`Product ${product.sku} is inactive`);
          }

          const discountAmount = item.discountAmount ?? 0;
          const lineSubtotal = item.quantity * product.unitPrice;

          if (discountAmount > lineSubtotal) {
            throw new Error(
              `Discount exceeds the amount for product ${product.sku}`,
            );
          }

          const lineTotal = calculateLineTotal(
            item.quantity,
            product.unitPrice,
            discountAmount,
          );

          return {
            productId: product.id,
            productNameSnapshot: product.name,
            skuSnapshot: product.sku,
            quantity: item.quantity,
            unitPrice: product.unitPrice,
            discountAmount,
            lineTotal,
          };
        });

        subtotal = orderItems.reduce(
          (sum, item) => sum + item.lineTotal,
          0,
        );

        updateData.items = {
          deleteMany: {},
          create: orderItems,
        };
      }

      const discountAmount =
        data.discountAmount ?? existing.discountAmount;

      const shippingAmount =
        data.shippingAmount ?? existing.shippingAmount;

      if (discountAmount > subtotal) {
        throw new Error("Order discount exceeds subtotal");
      }

      updateData.subtotal = subtotal;
      updateData.discountAmount = discountAmount;
      updateData.shippingAmount = shippingAmount;
      updateData.totalAmount = calculateTotal(
        subtotal,
        discountAmount,
        shippingAmount,
      );

      if (data.notes !== undefined) {
        updateData.notes = data.notes;
      }

      return tx.salesOrder.update({
        where: { id },
        data: updateData,
        select: salesOrderSelect,
      });
    });
  },
};

