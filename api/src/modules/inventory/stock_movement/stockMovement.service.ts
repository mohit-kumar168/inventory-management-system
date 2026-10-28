import { stockMovementRepository } from "./stockMovement.repository";

export const stockMovementService = {
  async list(filters: Parameters<
    typeof stockMovementRepository.findMany
  >[0]) {
    return stockMovementRepository.findMany(filters);
  },

  async getById(movementId: string) {
    const movement =
      await stockMovementRepository.findById(movementId);

    if (!movement) {
      throw Object.assign(new Error("Stock movement not found"), {
        statusCode: 404,
      });
    }

    let source:
      | { type: string; id: string; number: string }
      | null = null;

    if (movement.goodsReceiptItem) {
      source = {
        type: "GOODS_RECEIPT",
        id: movement.goodsReceiptItem.goodsReceipt.id,
        number: movement.goodsReceiptItem.goodsReceipt.receiptNo,
      };
    } else if (movement.shipmentItem) {
      source = {
        type: "SHIPMENT",
        id: movement.shipmentItem.shipment.id,
        number: movement.shipmentItem.shipment.shipmentNo,
      };
    } else if (movement.transferItem) {
      source = {
        type: "WAREHOUSE_TRANSFER",
        id: movement.transferItem.transfer.id,
        number: movement.transferItem.transfer.transferNo,
      };
    } else if (movement.adjustmentItem) {
      source = {
        type: "INVENTORY_ADJUSTMENT",
        id: movement.adjustmentItem.adjustment.id,
        number: movement.adjustmentItem.adjustment.adjustmentNo,
      };
    } else if (movement.returnItem) {
      source = {
        type: "RETURN",
        id: movement.returnItem.return.id,
        number: movement.returnItem.return.returnNo,
      };
    }

    return {
      ...movement,
      source,
    };
  },
};
