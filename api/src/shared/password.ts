import env from "../config/env";
import bcrypt from "bcrypt";

export const generateHash = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
};

export const compareHash = async (plainPassword: string, hashPassword: string): Promise<boolean> => {
  return await bcrypt.compare(plainPassword, hashPassword);
};
