import express from "express";

const app = express();

app.use(express.json());

app.get("/api/v1/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Inventory Management API is running",
  });
});

export default app;
