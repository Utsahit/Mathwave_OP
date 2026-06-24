import { AppError } from '../utils/app-error';
import { auditService } from './audit.service';
import { franchiseRepository } from '../repositories/franchise.repository';
import { branchRepository } from '../repositories/branch.repository';

export class FranchiseService {
  async createFranchise(
    data: {
      code: string;
      name: string;
      ownerName: string;
      ownerEmail: string;
    },
    adminUserId: string
  ) {
    const existing = await franchiseRepository.findByCode(data.code);
    if (existing) {
      throw new AppError(
        'Franchise code already exists.',
        409,
        'DUPLICATE_FRANCHISE_CODE'
      );
    }

    const franchise = await franchiseRepository.createFranchise({
      code: data.code.toUpperCase(),
      name: data.name,
      ownerName: data.ownerName,
      ownerEmail: data.ownerEmail,
    });

    auditService
      .logCreate(adminUserId, 'Franchise', franchise.id, {
        code: franchise.code,
        name: franchise.name,
      })
      .catch(() => {});

    return franchise;
  }

  async updateFranchise(
    id: string,
    data: {
      name?: string;
      ownerName?: string;
      ownerEmail?: string;
      isActive?: boolean;
    },
    adminUserId: string
  ) {
    const existing = await franchiseRepository.findById(id);
    if (!existing) {
      throw new AppError('Franchise not found.', 404, 'NOT_FOUND');
    }

    const franchise = await franchiseRepository.updateFranchise(id, data);

    auditService
      .logUpdate(
        adminUserId,
        'Franchise',
        id,
        { code: existing.code, name: existing.name },
        data as Record<string, unknown>
      )
      .catch(() => {});

    return franchise;
  }

  async listFranchises(page = 1, pageSize = 20) {
    return franchiseRepository.listFranchises(page, pageSize);
  }

  async assignBranch(franchiseId: string, branchId: string, adminUserId: string) {
    const franchise = await franchiseRepository.findById(franchiseId);
    if (!franchise) {
      throw new AppError('Franchise not found.', 404, 'FRANCHISE_NOT_FOUND');
    }

    const branch = await branchRepository.findById(branchId);
    if (!branch) {
      throw new AppError('Branch not found.', 404, 'BRANCH_NOT_FOUND');
    }

    const updated = await branchRepository.updateBranch(branchId, {
      franchise: { connect: { id: franchiseId } },
    } as any);

    auditService
      .logUpdate(adminUserId, 'Branch', branchId, {}, { franchiseId })
      .catch(() => {});

    return updated;
  }

  async removeBranch(branchId: string, adminUserId: string) {
    const branch = await branchRepository.findById(branchId);
    if (!branch) {
      throw new AppError('Branch not found.', 404, 'BRANCH_NOT_FOUND');
    }

    const updated = await branchRepository.updateBranch(branchId, {
      franchise: { disconnect: true },
    } as any);

    auditService
      .logUpdate(adminUserId, 'Branch', branchId, { franchiseId: branch.franchiseId }, {})
      .catch(() => {});

    return updated;
  }
}

export const franchiseService = new FranchiseService();
