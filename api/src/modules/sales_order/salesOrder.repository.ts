
import {
  Prisma,
  CustomerStatus,
  ProductStatus,
  ReservationStatus,
  SalesOrderStatus,
  FulfillmentStatus,
  WarehouseStatus,
} from "@prisma/client";
import prisma from "../../prisma/db";
import type {
  CreateSalesOrderInput,
  UpdateSalesOrderInput,
  ListSalesOrdersInput,
} from "./salesOrder.types";

const salesOrderSelect = {
  id: true,
  orderNo: true,
  customerId: true,
  status: true,
  paymentStatus: true,
  fulfillmentStatus: true,
  shippingAddressId: true,
  shippingRecipientName: true,
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
  orderedAt: true,
  cancelledAt: true,
  createdAt: true,
  updatedAt: true,
  customer: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      status: true,
    },
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
      quantity: true,
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
} satisfies Prisma.SalesOrderSelect;

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
          shippingAddressId: true,
          subtotal: true,
          discountAmount: true,
          shippingAmount: true,
        },
      });

      if (!existing) {
        throw new Error("Sales order not found");
      }

      if (existing.status !== SalesOrderStatus.DRAFT) {
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

        if (
          data.customerId !== existing.customerId &&
          !data.shippingAddressId &&
          !data.shippingAddress
        ) {
          updateData.shippingAddress = {
            disconnect: true,
          };
        }
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

  async confirm(id: string, warehouseId: string) {
    return prisma.$transaction(
      async (tx) => {
        const salesOrder = await tx.salesOrder.findUnique({
          where: { id },
          select: {
            id: true,
            status: true,
            items: {
              select: {
                id: true,
                productId: true,
                quantity: true,
                product: {
                  select: {
                    productStatus: true,
                  },
                },
              },
            },
          },
        });

        if (!salesOrder) {
          throw new Error("Sales order not found");
        }

        if (salesOrder.status !== SalesOrderStatus.DRAFT) {
          throw new Error("Only draft sales orders can be confirmed");
        }

        if (salesOrder.items.length === 0) {
          throw new Error("Sales order has no items");
        }

        const warehouse = await tx.warehouse.findUnique({
          where: { id: warehouseId },
          select: {
            id: true,
            status: true,
          },
        });

        if (!warehouse) {
          throw new Error("Warehouse not found");
        }

        if (warehouse.status !== WarehouseStatus.ACTIVE) {
          throw new Error("Warehouse is not active");
        }

        for (const item of salesOrder.items) {
          if (item.product.productStatus !== ProductStatus.ACTIVE) {
            throw new Error(
              `Product ${item.productId} is not active`,
            );
          }

          const inventoryBalance =
            await tx.inventoryBalance.findUnique({
              where: {
                productId_warehouseId: {
                  productId: item.productId,
                  warehouseId,
                },
              },
              select: {
                id: true,
                onHandQuantity: true,
                reservedQuantity: true,
                version: true,
              },
            });

          if (!inventoryBalance) {
            throw new Error(
              `Inventory balance not found for product ${item.productId}`,
            );
          }

          const availableQuantity =
            inventoryBalance.onHandQuantity -
            inventoryBalance.reservedQuantity;

          if (item.quantity > availableQuantity) {
            throw new Error(
              `Insufficient available inventory for product ${item.productId}`,
            );
          }

          const balanceUpdate = await tx.inventoryBalance.updateMany({
            where: {
              id: inventoryBalance.id,
              version: inventoryBalance.version,
            },
            data: {
              reservedQuantity: {
                increment: item.quantity,
              },
              version: {
                increment: 1,
              },
            },
          });

          if (balanceUpdate.count !== 1) {
            throw new Error(
              "Inventory changed during confirmation. Please retry",
            );
          }

          await tx.reservation.create({
            data: {
              salesOrderItemId: item.id,
              productId: item.productId,
              warehouseId,
              quantity: item.quantity,
            },
          });
        }

        const orderUpdate = await tx.salesOrder.updateMany({
          where: {
            id,
            status: SalesOrderStatus.DRAFT,
          },
          data: {
            status: SalesOrderStatus.CONFIRMED,
            fulfillmentStatus: FulfillmentStatus.RESERVED,
            orderedAt: new Date(),
          },
        });

        if (orderUpdate.count !== 1) {
          throw new Error(
            "Sales order status changed during confirmation. Please retry",
          );
        }

        return tx.salesOrder.findUnique({
          where: { id },
          select: salesOrderSelect,
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  },

  async cancel(id: string, reason: string) {
    return prisma.$transaction(
      async (tx) => {
        const salesOrder = await tx.salesOrder.findUnique({
          where: { id },
          select: {
            id: true,
            status: true,
            items: {
              select: {
                id: true,
              },
            },
          },
        });

        if (!salesOrder) {
          throw new Error("Sales order not found");
        }

        const cancellableStatuses: SalesOrderStatus[] = [
          SalesOrderStatus.DRAFT,
          SalesOrderStatus.PENDING,
          SalesOrderStatus.CONFIRMED,
        ];

        if (!cancellableStatuses.includes(salesOrder.status)) {
          throw new Error("This sales order cannot be cancelled");
        }

        if (salesOrder.status === SalesOrderStatus.CONFIRMED) {
          const itemIds = salesOrder.items.map((item) => item.id);

          const reservations = await tx.reservation.findMany({
            where: {
              salesOrderItemId: {
                in: itemIds,
              },
              status: {
                in: [
                  ReservationStatus.ACTIVE,
                  ReservationStatus.PARTIALLY_CONSUMED,
                ],
              },
            },
            select: {
              id: true,
              productId: true,
              warehouseId: true,
              quantity: true,
              quantityConsumed: true,
              quantityReleased: true,
            },
          });

          for (const reservation of reservations) {
            if (reservation.quantityConsumed > 0) {
              throw new Error(
                "Sales order cannot be cancelled because reserved stock has already been consumed",
              );
            }

            const outstandingQuantity =
              reservation.quantity -
              reservation.quantityConsumed -
              reservation.quantityReleased;

            if (outstandingQuantity <= 0) {
              continue;
            }

            const inventoryBalance =
              await tx.inventoryBalance.findUnique({
                where: {
                  productId_warehouseId: {
                    productId: reservation.productId,
                    warehouseId: reservation.warehouseId,
                  },
                },
                select: {
                  id: true,
                  reservedQuantity: true,
                  version: true,
                },
              });

            if (!inventoryBalance) {
              throw new Error(
                "Inventory balance not found while releasing reservation",
              );
            }

            if (
              inventoryBalance.reservedQuantity <
              outstandingQuantity
            ) {
              throw new Error(
                "Reserved inventory is inconsistent and cannot be released",
              );
            }

            const balanceUpdate = await tx.inventoryBalance.updateMany({
              where: {
                id: inventoryBalance.id,
                version: inventoryBalance.version,
                reservedQuantity: {
                  gte: outstandingQuantity,
                },
              },
              data: {
                reservedQuantity: {
                  decrement: outstandingQuantity,
                },
                version: {
                  increment: 1,
                },
              },
            });

            if (balanceUpdate.count !== 1) {
              throw new Error(
                "Inventory changed while releasing reservation. Please retry",
              );
            }

            await tx.reservation.update({
              where: { id: reservation.id },
              data: {
                quantityReleased: {
                  increment: outstandingQuantity,
                },
                status: ReservationStatus.RELEASED,
              },
            });
          }
        }

        const orderUpdate = await tx.salesOrder.updateMany({
          where: {
            id,
            status: salesOrder.status,
          },
          data: {
            status: SalesOrderStatus.CANCELLED,
            fulfillmentStatus: FulfillmentStatus.CANCELLED,
            cancellationReason: reason,
            cancelledAt: new Date(),
          },
        });

        if (orderUpdate.count !== 1) {
          throw new Error(
            "Sales order status changed during cancellation. Please retry",
          );
        }

        return tx.salesOrder.findUnique({
          where: { id },
          select: salesOrderSelect,
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  },
};

export default SalesOrderRepository;

