import { prisma } from '../config/prisma';
import { AppError } from '../utils/app-error';

export class AddressService {
  async listAddresses(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.customerAddress.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.customerAddress.count({ where: { userId } }),
    ]);
    return { data: items, total, page, limit };
  }

  async createAddress(
    userId: string,
    data: {
      label: string;
      addressLine1: string;
      addressLine2?: string;
      city: string;
      state: string;
      postalCode: string;
      country?: string;
      latitude?: number;
      longitude?: number;
      isDefault?: boolean;
    }
  ) {
    if (data.isDefault) {
      await prisma.customerAddress.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.customerAddress.create({
      data: {
        userId,
        label: data.label,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        country: data.country || 'India',
        latitude: data.latitude,
        longitude: data.longitude,
        isDefault: data.isDefault || false,
      },
    });
  }

  async getAddress(id: string, userId: string) {
    const address = await prisma.customerAddress.findFirst({
      where: { id, userId },
    });
    if (!address) throw new AppError('Address not found.', 404, 'ADDRESS_NOT_FOUND');
    return address;
  }

  async updateAddress(
    id: string,
    userId: string,
    data: {
      label?: string;
      addressLine1?: string;
      addressLine2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
      latitude?: number;
      longitude?: number;
      isDefault?: boolean;
    }
  ) {
    await this.getAddress(id, userId);

    if (data.isDefault) {
      await prisma.customerAddress.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.customerAddress.update({
      where: { id },
      data,
    });
  }

  async deleteAddress(id: string, userId: string) {
    await this.getAddress(id, userId);
    await prisma.customerAddress.delete({ where: { id } });
  }
}

export const addressService = new AddressService();
