import { z } from "zod";

export const registerSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.email(),
  password: z.string().min(8).max(100),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(100),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
}).refine(
  (data) =>
    data.firstName !== undefined ||
    data.lastName !== undefined,
  { message: "At least one field must be provided" },
)

export type RegisterInput = z.output<typeof registerSchema>;
export type LoginInput = z.output<typeof loginSchema>;
export type RefreshTokenInput = z.output<typeof refreshTokenSchema>;
export type UpdateProfileInput = z.output<typeof updateProfileSchema>;
