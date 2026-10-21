import prisma from "../../prisma/db";

export const AuthRepository = {

  findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  },

  findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
    });
  },

  createUser(data: {
    firstName: string,
    lastName: string,
    email: string,
    passwordHash: string,
  }) {
    return prisma.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        passwordHash: data.passwordHash,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
    })
  },

  createRefreshToken(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }) {
    return prisma.refreshToken.create({ data });
  },

  revokeRefreshToken(tokenHash: string) {
    return prisma.refreshToken.updateMany({
      where: {
        tokenHash,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      },
    });
  },

  rotateRefreshToken(
    oldHash: string,
    newHash: string,
    expiresAt: Date,
  ) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.refreshToken.findFirst({
        where: {
          tokenHash: oldHash,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      if (!existing) return null;

      const revoked = await tx.refreshToken.updateMany({
        where: {
          id: existing.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date()
        },
      });

      if (revoked.count !== 1) return null;

      await tx.refreshToken.create({
        data: {
          userId: existing.userId,
          tokenHash: newHash,
          expiresAt,
        },
      });

      return tx.user.findUnique({
        where: {
          id: existing.userId,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
        },
      });
    })
  },

  updateProfile(
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
    },
  ) {
    return prisma.user.update({
      where: {
        id,
      },
      data,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },
};
