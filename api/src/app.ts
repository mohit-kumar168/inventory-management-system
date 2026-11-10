import express from "express";
import cookieParser from "cookie-parser";
import authRoutes from "./modules/auth/auth.routes";
import categoryRoutes from "./modules/categories/category.routes";
import productRoutes from "./modules/products/product.routes";
import warehouseRoutes from "./modules/warehouses/warehouse.routes";
import supplierRoutes from "./modules/supplier/supplier.routes";
import inventoryRoutes from "./modules/inventory/inventory/inventory.routes";
import purchaseOrderRoutes from "./modules/purchase/purchase_order/purchaseOrder.routes";
import goodsReceiptRoutes from "./modules/goods_receipt/goodsReceipt.routes";
import customerRoutes from "./modules/customer/customer.routes";
import reservationRoutes from "./modules/reservation/reservation.routes";

const app = express();

app.use(express.json());
app.use(cookieParser());

app.get("/api/v1/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Inventory Management API is running",
  });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/warehouses", warehouseRoutes);
app.use("/api/v1/suppliers", supplierRoutes);
app.use("/api/v1/inventory", inventoryRoutes);
app.use("/api/v1/purchase-order", purchaseOrderRoutes);
app.use("/api/v1/goods-receipt", goodsReceiptRoutes);
app.use("/api/v1/customers", customerRoutes);
app.use("api/v1/reservations", reservationRoutes);

export default app;
