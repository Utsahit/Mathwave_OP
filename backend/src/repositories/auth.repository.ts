import { prisma } from '../config/prisma';

/**
 * Data Access Repository for Authentication and Session Operations
 */
export class AuthRepository {
  /**
   * Retrieves an active user profile by email address
   */
  async findUserByEmail(email: string) {
    return prisma.user.findFirst({
      where: {
        email,
        isDeleted: false,
      },
      include: {
        role: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Retrieves an active user profile by user UUID
   */
  async findUserById(id: string) {
    return prisma.user.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        role: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Registers a new User record in the database
   */
  async createUser(data: {
    email: string;
    passwordHash: string;
    name: string;
    roleId: string;
  }) {
    return prisma.user.create({
      data,
      include: {
        role: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Retrieves a DbRole by its unique name string (e.g. 'CUSTOMER', 'ADMIN')
   */
  async findRoleByName(name: string) {
    return prisma.dbRole.findUnique({
      where: { name },
    });
  }

  /**
   * Creates a new UserSession record tracking active login devices
   */
  async createSession(data: {
    id: string;
    userId: string;
    refreshToken: string; // Stores token's SHA-256 hash value
    deviceInfo?: string | null;
    ipAddress?: string | null;
    expiresAt: Date;
  }) {
    return prisma.userSession.create({
      data,
    });
  }

  /**
   * Retrieves an active session record matching a specific refresh token hash.
   * SECURITY: Uses select() to prevent passwordHash from loading into memory.
   */
  async findSessionByTokenHash(refreshToken: string) {
    return prisma.userSession.findUnique({
      where: { refreshToken },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            roleId: true,
            isDeleted: true,
            role: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  /**
   * Deletes a specific session ID (Logout)
   */
  async deleteSession(id: string) {
    return prisma.userSession.delete({
      where: { id },
    });
  }

  /**
   * Deletes all sessions associated with a specific user (Logout All)
   */
  async deleteUserSessions(userId: string) {
    return prisma.userSession.deleteMany({
      where: { userId },
    });
  }

  /**
   * Queries permissions linked to a specific DbRole via RolePermission join table.
   * Only fetches permission.name — avoids loading description and timestamps.
   */
  async findRolePermissions(roleId: string) {
    return prisma.rolePermission.findMany({
      where: { roleId },
      include: {
        permission: { select: { name: true } },
      },
    });
  }

  /**
   * Updates user credentials hash for a specific user ID
   */
  async updateUserPassword(userId: string, passwordHash: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }
}

export default AuthRepository;
