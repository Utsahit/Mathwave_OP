import { AppError } from '../utils/app-error';
import { auditService } from './audit.service';
import { notificationService } from './notification.service';
import { branchRepository } from '../repositories/branch.repository';

export class BranchService {
  async createBranch(
    data: {
      code: string;
      name: string;
      email?: string;
      phone?: string;
      address: string;
      city: string;
      state: string;
      country: string;
      postalCode?: string;
      timezone: string;
      franchiseId?: string;
    },
    adminUserId: string
  ) {
    const existing = await branchRepository.findByCode(data.code);
    if (existing) {
      throw new AppError('Branch code already exists.', 409, 'DUPLICATE_BRANCH_CODE');
    }

    const branch = await branchRepository.createBranch({
      code: data.code.toUpperCase(),
      name: data.name,
      email: data.email,
      phone: data.phone,
      address: data.address,
      city: data.city,
      state: data.state,
      country: data.country,
      postalCode: data.postalCode,
      timezone: data.timezone,
      franchise: data.franchiseId ? { connect: { id: data.franchiseId } } : undefined,
    });

    auditService
      .logCreate(adminUserId, 'Branch', branch.id, {
        code: branch.code,
        name: branch.name,
      })
      .catch(() => {});

    notificationService
      .create(
        null,
        null,
        'BRANCH_CREATED',
        'Branch Created',
        `Branch "${branch.name}" (${branch.code}) has been created.`,
        'IN_APP',
        { branchId: branch.id, branchCode: branch.code }
      )
      .catch(() => {});

    return branch;
  }

  async updateBranch(
    id: string,
    data: {
      name?: string;
      email?: string;
      phone?: string;
      address?: string;
      city?: string;
      state?: string;
      country?: string;
      postalCode?: string;
      timezone?: string;
      isActive?: boolean;
      franchiseId?: string | null;
    },
    adminUserId: string
  ) {
    const existing = await branchRepository.findById(id);
    if (!existing) {
      throw new AppError('Branch not found.', 404, 'NOT_FOUND');
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.state !== undefined) updateData.state = data.state;
    if (data.country !== undefined) updateData.country = data.country;
    if (data.postalCode !== undefined) updateData.postalCode = data.postalCode;
    if (data.timezone !== undefined) updateData.timezone = data.timezone;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.franchiseId !== undefined) {
      updateData.franchise = data.franchiseId
        ? { connect: { id: data.franchiseId } }
        : { disconnect: true };
    }

    const branch = await branchRepository.updateBranch(id, updateData as any);

    auditService
      .logUpdate(
        adminUserId,
        'Branch',
        id,
        { code: existing.code, name: existing.name },
        data as Record<string, unknown>
      )
      .catch(() => {});

    return branch;
  }

  async deleteBranch(id: string, adminUserId: string) {
    const existing = await branchRepository.findById(id);
    if (!existing) {
      throw new AppError('Branch not found.', 404, 'NOT_FOUND');
    }

    const branch = await branchRepository.deleteBranch(id);

    auditService
      .logDelete(adminUserId, 'Branch', id, {
        code: existing.code,
        name: existing.name,
      })
      .catch(() => {});

    return branch;
  }

  async listBranches(
    page = 1,
    pageSize = 20,
    filters?: {
      isActive?: boolean;
      city?: string;
      state?: string;
      country?: string;
      franchiseId?: string;
      search?: string;
    }
  ) {
    return branchRepository.listBranches(page, pageSize, filters);
  }

  async getBranch(id: string) {
    const branch = await branchRepository.findById(id);
    if (!branch) {
      throw new AppError('Branch not found.', 404, 'NOT_FOUND');
    }
    return branch;
  }
}

export const branchService = new BranchService();
