import type { UserRole, UserStatus } from "@prisma/client";

declare global {
  namespace Express {
    interface User {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      role: UserRole;
      status: UserStatus;
    }

    interface Request {
      user?: User;
    }
  }
}

export { };
