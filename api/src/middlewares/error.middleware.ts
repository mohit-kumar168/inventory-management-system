import type { Request, Response, NextFunction } from "express";
import apiError from "../shared/apiError";
import logger from "../config/logger";

export default function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  logger.error({
    err,
    method: req.method,
    path: req.originalUrl,
    //userId: req.user?.id,
  },
    "Request failed",
  );

  if (err instanceof apiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message
    })
  }

  return res.status(500).json({
    success: false,
    message: "Internal Server Error",
  });
};
