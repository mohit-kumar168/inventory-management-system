
import type { RequestHandler } from "express";
import { AuthRepository } from "../modules/auth/auth.repository";
import { verifyAccessToken } from "../shared/jwt";
import asyncHandler from "../shared/asyncHandler";
import ApiError from "../shared/apiError";

export const authenticate: RequestHandler = asyncHandler(
  async (req, res, next) => {
    const cookieToken = req.cookies?.accessToken;
    const authorization = req.headers.authorization;

    const token =
      typeof cookieToken === "string" && cookieToken
        ? cookieToken
        : authorization?.startsWith("Bearer ")
          ? authorization.slice("Bearer ".length).trim()
          : undefined;

    if (!token) {
      throw new ApiError(401, "Authentication required");
    }

    let payload;

    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new ApiError(401, "Invalid or expired access token");
    }

    const user = await AuthRepository.findById(payload.id);

    if (!user || user.status !== "ACTIVE") {
      throw new ApiError(401, "User not found or inactive");
    }

    req.user = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      status: user.status,
    };

    next();
  },
);

