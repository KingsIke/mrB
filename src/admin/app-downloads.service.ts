import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual, IsNull, Not } from 'typeorm';
import { AppDownloadClick } from './entities/app-download-click.entity';
import { AppDownloadStatsQueryDto, AppDownloadChartQueryDto } from './dto/app-downloads.dto';

export interface AppDownloadStats {
  /** Total clicks ever recorded */
  totalClicks: number;
  /** Clicks deduplicated by ipHash (anonymous unique visitors) */
  uniqueClicks: number;
  /** Clicks from authenticated users */
  authenticatedClicks: number;
  /** Clicks in the requested window */
  windowClicks: number;
  /** Breakdown by source */
  bySource: { source: string; count: number }[];
  /** Daily click counts for the requested window */
  dailyClicks: { date: string; count: number }[];
  /** Recent clicks (newest first) */
  recentClicks: {
    id: string;
    source: string;
    pageUrl: string | null;
    userAgent: string | null;
    userId: string | null;
    createdAt: string;
  }[];
}

@Injectable()
export class AppDownloadsService {
  constructor(
    @InjectRepository(AppDownloadClick)
    private readonly clickRepo: Repository<AppDownloadClick>,
  ) {}

  async track(source: string, pageUrl: string | null, ipHash: string | null, userAgent: string | null, userId: string | null): Promise<AppDownloadClick> {
    const click = this.clickRepo.create({ source, pageUrl, ipHash, userAgent, userId });
    return this.clickRepo.save(click);
  }

  async getStats(query: AppDownloadStatsQueryDto): Promise<AppDownloadStats> {
    const where = this.buildWhere(query);

    const [total, unique, authenticated, recent, bySourceRaw, dailyRaw] = await Promise.all([
      this.clickRepo.count({ where }),
      this.clickRepo.createQueryBuilder('c').select('COUNT(DISTINCT c."ipHash")', 'cnt').where(where).getRawOne().then(r => Number(r?.cnt ?? 0)),
      this.clickRepo.count({ where: { userId: Not(IsNull()) } }),
      this.clickRepo.find({
        where,
        order: { createdAt: 'DESC' },
        take: 20,
        select: ['id', 'source', 'pageUrl', 'userAgent', 'userId', 'createdAt'],
      }),
      this.clickRepo
        .createQueryBuilder('c')
        .select('c.source', 'source')
        .addSelect('COUNT(*)', 'count')
        .where(where)
        .groupBy('c.source')
        .getRawMany(),
      this.buildDailyQuery(query).getRawMany(),
    ]);

    return {
      totalClicks: total,
      uniqueClicks: unique,
      authenticatedClicks: authenticated,
      windowClicks: total,
      bySource: bySourceRaw.map((r) => ({ source: r.source, count: Number(r.count) })),
      dailyClicks: dailyRaw.map((r) => ({ date: r.date, count: Number(r.count) })),
      recentClicks: recent.map((c) => ({
        id: c.id,
        source: c.source,
        pageUrl: c.pageUrl,
        userAgent: c.userAgent,
        userId: c.userId,
        createdAt: c.createdAt.toISOString(),
      })),
    };
  }

  async getChartData(query: AppDownloadChartQueryDto): Promise<{ date: string; count: number }[]> {
    const days = query.days ?? 30;
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);

    const rows = await this.clickRepo
      .createQueryBuilder('c')
      .select("DATE_TRUNC('day', c.\"createdAt\"::timestamp)", 'date')
      .addSelect('COUNT(*)', 'count')
      .where('c.\"createdAt\" >= :start', { start })
      .andWhere('c.\"createdAt\" <= :end', { end })
      .groupBy("DATE_TRUNC('day', c.\"createdAt\"::timestamp)")
      .orderBy('date', 'ASC')
      .getRawMany();

    return rows.map((r) => ({ date: r.date, count: Number(r.count) }));
  }

  private buildWhere(query: AppDownloadStatsQueryDto): object {
    const { from, to } = query;
    if (from && to) return { createdAt: Between(new Date(from), new Date(to)) };
    if (from) return { createdAt: MoreThanOrEqual(new Date(from)) };
    if (to) return { createdAt: LessThanOrEqual(new Date(to)) };
    return {};
  }

  private buildDailyQuery(query: AppDownloadStatsQueryDto) {
    const { from, to } = query;
    const qb = this.clickRepo
      .createQueryBuilder('c')
      .select("DATE_TRUNC('day', c.\"createdAt\"::timestamp)", 'date')
      .addSelect('COUNT(*)', 'count');

    if (from && to) {
      qb.where('c.\"createdAt\" BETWEEN :from AND :to', { from: new Date(from), to: new Date(to) });
    } else if (from) {
      qb.where('c.\"createdAt\" >= :from', { from: new Date(from) });
    } else if (to) {
      qb.where('c.\"createdAt\" <= :to', { to: new Date(to) });
    }

    return qb.groupBy("DATE_TRUNC('day', c.\"createdAt\"::timestamp)").orderBy('date', 'ASC');
  }
}

