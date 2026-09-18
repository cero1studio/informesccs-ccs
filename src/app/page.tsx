import { prisma } from '@/lib/prisma';
import DashboardClient from '@/components/DashboardClient';
import { subDays } from 'date-fns';

const BOT_TAGS = [
  'asesoriamigracion', 'certificados', 'renovaciones', 'mitaciones',
  'tramites', 'tunegocio', 'infogeneral', 'asesorialegal',
];

const MIGRATION_STATUSES = [105235459, 105235467];
const LEGAL_STATUSES     = [111279076, 111279080];
const ATTENDED_STATUSES  = [...MIGRATION_STATUSES, ...LEGAL_STATUSES, 105235463];

export default async function DashboardPage() {
  const from = subDays(new Date(), 30);
  const to   = new Date();

  // Leads NUEVOS en el período (por cuándo contactaron)
  const dateFilter     = { createdAt: { gte: from, lte: to } };
  // Atendidos en el período (por cuándo fueron atendidos)
  const attendedFilter = { updatedAt: { gte: from, lte: to } };

  const MIGRATION_EN_PROCESO = [105235459];
  const MIGRATION_COMPLETADO = [105235467];
  const LEGAL_EN_PROCESO     = [111279076];
  const LEGAL_COMPLETADO     = [111279080];

  const [
    totalLeads,
    enProcesoMigracion,
    completadosMigracion,
    enProcesoLegal,
    completadosLegal,
    enEsperaMigracion,
    enEsperaLegal,
    sinReplica,
    totalInDB,
    leadsPerDay,
  ] = await Promise.all([
    prisma.lead.count({ where: dateFilter }),
    prisma.lead.count({ where: { statusId: { in: MIGRATION_EN_PROCESO }, ...attendedFilter } }),
    prisma.lead.count({ where: { statusId: { in: MIGRATION_COMPLETADO }, ...attendedFilter } }),
    prisma.lead.count({ where: { statusId: { in: LEGAL_EN_PROCESO },     ...attendedFilter } }),
    prisma.lead.count({ where: { statusId: { in: LEGAL_COMPLETADO },     ...attendedFilter } }),
    prisma.leadTag.count({ where: { tag: { name: 'asesoriamigracion' }, lead: { statusId: { notIn: MIGRATION_STATUSES } } } }),
    prisma.leadTag.count({ where: { tag: { name: 'asesorialegal' },     lead: { statusId: { notIn: LEGAL_STATUSES } } } }),
    prisma.lead.count({ where: { statusId: { notIn: ATTENDED_STATUSES }, ...dateFilter } }),
    prisma.lead.count(),
    prisma.$queryRaw<Array<{ day: string; count: bigint }>>`
      SELECT strftime('%Y-%m-%d', datetime(createdAt / 1000, 'unixepoch')) as day, COUNT(*) as count
      FROM Lead
      WHERE createdAt >= ${from.getTime()} AND createdAt <= ${to.getTime()}
      GROUP BY day ORDER BY day ASC
    `,
  ]);

  const atendidosMigracion = enProcesoMigracion + completadosMigracion;
  const atendidosLegal     = enProcesoLegal + completadosLegal;

  const tagCounts: Record<string, number> = {};
  for (const tagName of BOT_TAGS) {
    tagCounts[tagName] = await prisma.leadTag.count({
      where: { tag: { name: tagName }, lead: dateFilter }
    });
  }

  return <DashboardClient initialMetrics={{
    totalLeads,
    atendidosMigracion,
    enProcesoMigracion,
    completadosMigracion,
    atendidosLegal,
    enProcesoLegal,
    completadosLegal,
    enEsperaMigracion,
    enEsperaLegal,
    sinReplica,
    tagCounts,
    leadsPerDay: leadsPerDay.map(r => ({ day: r.day, count: Number(r.count) })),
    totalInDB,
  }} />;
}
