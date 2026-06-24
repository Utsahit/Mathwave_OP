import { prisma } from '../config/prisma';
import { CampaignType } from '@prisma/client';
import { AppError } from '../utils/app-error';
import { queueService } from './queue.service';
import { logger } from '../config/logger';

export class CampaignService {
  async createCampaign(data: {
    name: string;
    description?: string;
    type: CampaignType;
    subject?: string;
    content: string;
    scheduledAt?: string;
    createdBy?: string;
  }) {
    return prisma.marketingCampaign.create({
      data: {
        name: data.name,
        description: data.description,
        type: data.type,
        subject: data.subject,
        content: data.content,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
        createdBy: data.createdBy,
        status: data.scheduledAt ? 'SCHEDULED' : 'DRAFT',
      },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        subject: true,
        scheduledAt: true,
        createdAt: true,
      },
    });
  }

  async listCampaigns(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.marketingCampaign.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          subject: true,
          scheduledAt: true,
          startedAt: true,
          completedAt: true,
          createdAt: true,
          _count: { select: { recipients: true } },
        },
      }),
      prisma.marketingCampaign.count(),
    ]);
    return { data: items, total, page, limit };
  }

  async getCampaign(id: string) {
    const campaign = await prisma.marketingCampaign.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        status: true,
        subject: true,
        content: true,
        scheduledAt: true,
        startedAt: true,
        completedAt: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { recipients: true } },
      },
    });
    if (!campaign) throw new AppError('Campaign not found.', 404, 'CAMPAIGN_NOT_FOUND');
    return campaign;
  }

  async updateCampaign(
    id: string,
    data: {
      name?: string;
      description?: string;
      subject?: string;
      content?: string;
      scheduledAt?: string;
    }
  ) {
    const existing = await prisma.marketingCampaign.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) throw new AppError('Campaign not found.', 404, 'CAMPAIGN_NOT_FOUND');
    if (existing.status !== 'DRAFT' && existing.status !== 'SCHEDULED') {
      throw new AppError(
        'Only DRAFT or SCHEDULED campaigns can be updated.',
        422,
        'INVALID_CAMPAIGN_STATUS'
      );
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.subject !== undefined) updateData.subject = data.subject;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.scheduledAt !== undefined)
      updateData.scheduledAt = new Date(data.scheduledAt);

    return prisma.marketingCampaign.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        scheduledAt: true,
        updatedAt: true,
      },
    });
  }

  async deleteCampaign(id: string) {
    const existing = await prisma.marketingCampaign.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) throw new AppError('Campaign not found.', 404, 'CAMPAIGN_NOT_FOUND');
    if (existing.status === 'RUNNING') {
      throw new AppError(
        'Cannot delete a running campaign. Cancel it first.',
        422,
        'CAMPAIGN_RUNNING'
      );
    }
    await prisma.marketingCampaign.delete({ where: { id } });
  }

  async startCampaign(id: string) {
    const campaign = await prisma.marketingCampaign.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        type: true,
        subject: true,
        content: true,
        name: true,
      },
    });
    if (!campaign) throw new AppError('Campaign not found.', 404, 'CAMPAIGN_NOT_FOUND');
    if (campaign.status !== 'DRAFT' && campaign.status !== 'SCHEDULED') {
      throw new AppError(
        'Only DRAFT or SCHEDULED campaigns can be started.',
        422,
        'INVALID_CAMPAIGN_STATUS'
      );
    }

    const updated = await prisma.marketingCampaign.update({
      where: { id },
      data: { status: 'RUNNING', startedAt: new Date() },
      select: { id: true, name: true, status: true, startedAt: true },
    });

    await queueService.enqueue('CAMPAIGN_DISPATCH', {
      campaignId: id,
      type: campaign.type,
      subject: campaign.subject,
      content: campaign.content,
    });

    logger.info({ campaignId: id, type: campaign.type }, 'Campaign dispatch queued');
    return updated;
  }

  async cancelCampaign(id: string) {
    const campaign = await prisma.marketingCampaign.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!campaign) throw new AppError('Campaign not found.', 404, 'CAMPAIGN_NOT_FOUND');
    if (campaign.status === 'COMPLETED' || campaign.status === 'CANCELLED') {
      throw new AppError(
        'Campaign is already completed or cancelled.',
        422,
        'INVALID_CAMPAIGN_STATUS'
      );
    }

    return prisma.marketingCampaign.update({
      where: { id },
      data: { status: 'CANCELLED', completedAt: new Date() },
      select: { id: true, name: true, status: true, completedAt: true },
    });
  }

  async campaignAnalytics(id: string) {
    const campaign = await prisma.marketingCampaign.findUnique({
      where: { id },
      select: { id: true, name: true, type: true, status: true },
    });
    if (!campaign) throw new AppError('Campaign not found.', 404, 'CAMPAIGN_NOT_FOUND');

    const [totalSent, totalDelivered, totalOpened, totalClicked] = await Promise.all([
      prisma.campaignRecipient.count({ where: { campaignId: id } }),
      prisma.campaignRecipient.count({ where: { campaignId: id, isDelivered: true } }),
      prisma.campaignRecipient.count({ where: { campaignId: id, isOpened: true } }),
      prisma.campaignRecipient.count({ where: { campaignId: id, isClicked: true } }),
    ]);

    return {
      campaignId: campaign.id,
      name: campaign.name,
      type: campaign.type,
      status: campaign.status,
      totalSent,
      totalDelivered,
      totalOpened,
      totalClicked,
      deliveryRate:
        totalSent > 0 ? Math.round((totalDelivered / totalSent) * 10000) / 100 : 0,
      openRate:
        totalDelivered > 0 ? Math.round((totalOpened / totalDelivered) * 10000) / 100 : 0,
      clickRate:
        totalOpened > 0 ? Math.round((totalClicked / totalOpened) * 10000) / 100 : 0,
    };
  }
}

export const campaignService = new CampaignService();
