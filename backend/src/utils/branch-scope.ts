import { prisma } from '../config/prisma';

export type BranchScope = string[] | null;

export async function getUserBranchIds(userId: string): Promise<BranchScope> {
  const staffEntries = await prisma.branchStaff.findMany({
    where: { userId },
    select: { branchId: true },
  });
  if (staffEntries.length === 0) return [];
  return staffEntries.map((s) => s.branchId);
}

export function withBranchFilter<T extends Record<string, unknown>>(
  where: T,
  scope: BranchScope,
  field: string = 'branchId'
): T {
  if (scope === null) return where;
  if (scope.length === 0) return { ...where, [field]: null };
  return { ...where, [field]: { in: scope } } as T;
}

export function canAccessBranch(scope: BranchScope, branchId: string): boolean {
  if (scope === null) return true;
  return scope.includes(branchId);
}
