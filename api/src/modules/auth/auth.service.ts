import { AuthRepository } from "./auth.repository";
import type { LoginInput, RegisterInput, UpdateProfileInput } from "./auth.types";
import ApiError from "../../shared/apiError";
import logger from "../../config/logger";
import { generateHash, compareHash } from "../../shared/password";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../shared/jwt";
import { Prisma, UserStatus } from "@prisma/client";
import { hashToken } from "../../shared/tokenHash";


const REFRESH_TOKEN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

async function createSession(userId: string) {
  const accessToken = generateAccessToken(userId);
  const refreshToken = generateRefreshToken(userId);

  await AuthRepository.createRefreshToken({
    userId,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_LIFETIME_MS),
  })

  return { accessToken, refreshToken };
}

export const AuthService = {
  async register(input: RegisterInput) {
    const existingUser = await AuthRepository.findByEmail(input.email);

    if (existingUser) {
      throw new ApiError(
        409,
        "An account with this email already exists."
      );
    }

    const passwordHash = await generateHash(input.password);

    try {
      const user = await AuthRepository.createUser({
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        passwordHash,
      });

      const token = await createSession(user.id);

      logger.info(
        { userId: user.id },
        "User registered successfully",
      );

      return {
        user,
        ...token,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ApiError(
          409,
          "An account with this email already exists",
        );
      }

      throw error;
    }
  },

  async login(input: LoginInput) {
    const user = await AuthRepository.findByEmail(input.email);

    if (!user || !(await compareHash(input.password, user.passwordHash))) {
      logger.warn("Login failed: invalid credentials");
      throw new ApiError(401, "Invalid email or password");
    }

    if (user.status !== UserStatus.ACTIVE) {
      logger.warn(
        { userId: user.id },
        "Login rejected: account is not active",
      );

      throw new ApiError(403, "Your account is not active");
    }

    const token = await createSession(user.id);

    const publicUser = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    };

    logger.info(
      { userId: user.id },
      "User logged in successfully",
    );

    return {
      user: publicUser,
      ...token,
    };
  },

  async refresh(refreshToken: string) {
    let payload: ReturnType<typeof verifyRefreshToken>;

    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new ApiError(401, "Invalid or expired refresh token");
    }

    const newRefreshToken = generateRefreshToken(payload.id);
    const newRefreshHash = hashToken(newRefreshToken);

    const user = await AuthRepository.rotateRefreshToken(
      hashToken(refreshToken),
      newRefreshHash,
      new Date(Date.now() + REFRESH_TOKEN_LIFETIME_MS),
    )

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new ApiError(401, "Refresh toke is revoked or expired");
    }


    const accessToken = generateAccessToken(user.id);

    return {
      user,
      accessToken,
      refreshToken: newRefreshToken
    }
  },

  async logout(refreshToken?: string) {
    if (refreshToken) {
      await AuthRepository.revokeRefreshToken(hashToken(refreshToken));
    }
  },

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const user = await AuthRepository.findById(userId);

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new ApiError(404, "User not found");
    }

    return AuthRepository.updateProfile(userId, input);
  }
};
