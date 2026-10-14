import type { SignOptions } from "jsonwebtoken";
import z from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  PORT: z.coerce.number().default(8000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.string().min(1, "DIRECT_URL is required"),

  ACCESS_TOKEN_SECRET: z.string().min(1, "ACCESS_TOKEN_SECRET is required"),
  ACCESS_TOKEN_EXPIRES_IN: z.custom<SignOptions["expiresIn"]>(),

  REFRESH_TOKEN_SECRET: z.string().min(1, "REFRESH_TOKEN_SECRET is required"),
  REFRESH_TOKEN_EXPIRES_IN: z.custom<SignOptions["expiresIn"]>(),
})

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid environment variables");

  console.table(
    parsedEnv.error.issues.map((issue) => ({
      variable: issue.path.join("."),
      Error: issue.message
    }))
  );
  process.exit(1);
}

const env = parsedEnv.data;

export default env;
