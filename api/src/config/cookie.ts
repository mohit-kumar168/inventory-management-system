import type { CookieOptions } from "express";
import env from "./env";

const isProduction = env.NODE_ENV === "production";

export const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax",
  path: "/api/v1",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};
