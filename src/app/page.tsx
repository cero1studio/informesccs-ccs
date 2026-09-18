import { PrismaClient } from '@prisma/client';
import DashboardClient from '@/components/DashboardClient';
import { subDays } from 'date-fns';

const prisma = new PrismaClient();

const BOT_TAGS = [
  'asesoriamigracion', 'certificados', 'renovaciones', 'mitaciones',
  'tramites', 'tunegocio', 'infogeneral', 'asesorialegal',
];

const MIGRATION_STATUSES = [105235459, 105235467];
const SIN_REPLICA_STATUS = 105235455;

export default async function DashboardPage() {
  const from = subDays(new Date(), 30);
  const to = new Date();

  const [totalLeads, atendidosMigracion, sinReplica, totalInDB, leadsPerDay] = await Promise.all([
    prisma.lead.count({ where: { createdAt: { gte: from, lte: to } } }),
    prisma.lead.count({ where: { statusId: { in: MIGRATION_STATUSES }, createdAt: { gte: from, lte: to } } }),
    prisma.lead.count({ where: { statusId: SIN_REPLICA_STATUS, createdAt: { gte: from, lte: to } } }),
    prisma.lead.count(),
    prisma.$queryRaw<Array<{ day: string; count: bigint }>>`
      SELECT
        strftime('%Y-%m-%d', datetime(createdAt / 1000, 'unixepoch')) as day,
        COUNT(*) as count
      FROM Lead
      WHERE createdAt >= ${from.getTime()} AND createdAt <= ${to.getTime()}
      GROUP BY day
      ORDER BY day ASC
    `,
  ]);

  const tagCounts: Record<string, number> = {};
  for (const tagName of BOT_TAGS) {
    const count = await prisma.leadTag.count({
      where: {
        tag: { name: tagName },
        lead: { createdAt: { gte: from, lte: to } }
      }
    });
    tagCounts[tagName] = count;
  }

  const initialMetrics = {
    totalLeads,
    atendidosMigracion,
    sinReplica,
    tagCounts,
    leadsPerDay: leadsPerDay.map(r => ({ day: r.day, count: Number(r.count) })),
    totalInDB,
  };

  return <DashboardClient initialMetrics={initialMetrics} />;
}
