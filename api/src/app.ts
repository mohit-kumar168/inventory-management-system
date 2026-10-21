import express from "express";
import cookieParser from "cookie-parser";
import authRoutes from "./modules/auth/auth.routes";

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

export default app;
