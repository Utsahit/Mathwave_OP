import { prisma } from '../config/prisma';
import { AppError } from '../utils/app-error';

export class FavoritesService {
  async addFavorite(userId: string, menuItemId: string) {
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: menuItemId },
      select: { id: true, isActive: true, isDeleted: true },
    });
    if (!menuItem || !menuItem.isActive || menuItem.isDeleted) {
      throw new AppError('Menu item not found.', 404, 'MENU_ITEM_NOT_FOUND');
    }

    const existing = await prisma.favoriteMenuItem.findUnique({
      where: { userId_menuItemId: { userId, menuItemId } },
    });
    if (existing) {
      throw new AppError('Item already in favorites.', 409, 'ALREADY_FAVORITE');
    }

    return prisma.favoriteMenuItem.create({
      data: { userId, menuItemId },
      include: {
        menuItem: {
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            image: true,
            tag: true,
          },
        },
      },
    });
  }

  async removeFavorite(userId: string, menuItemId: string) {
    const existing = await prisma.favoriteMenuItem.findUnique({
      where: { userId_menuItemId: { userId, menuItemId } },
    });
    if (!existing) {
      throw new AppError('Favorite not found.', 404, 'FAVORITE_NOT_FOUND');
    }
    await prisma.favoriteMenuItem.delete({ where: { id: existing.id } });
  }

  async listFavorites(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.favoriteMenuItem.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          menuItem: {
            select: {
              id: true,
              name: true,
              slug: true,
              price: true,
              image: true,
              tag: true,
            },
          },
        },
      }),
      prisma.favoriteMenuItem.count({ where: { userId } }),
    ]);
    return { data: items, total, page, limit };
  }
}

export const favoritesService = new FavoritesService();
