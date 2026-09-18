import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const BOT_TAGS = [
  'asesoriamigracion',
  'certificados',
  'renovaciones',
  'mitaciones',
  'tramites',
  'tunegocio',
  'infogeneral',
  'asesorialegal',
];

// Pipeline statuses (from Kommo: "Embudo de ventas" id: 13636179)
const MIGRATION_EN_PROCESO = [105235459];           // 'migración' (en trámite)
const MIGRATION_COMPLETADO = [105235467];           // 'migración atendido' (cerrado)
const MIGRATION_STATUSES   = [...MIGRATION_EN_PROCESO, ...MIGRATION_COMPLETADO];
const LEGAL_EN_PROCESO     = [111279076];           // 'abogado' (en trámite)
const LEGAL_COMPLETADO     = [111279080];           // 'abogado atendido' (cerrado)
const LEGAL_STATUSES       = [...LEGAL_EN_PROCESO, ...LEGAL_COMPLETADO];
const ATTENDED_STATUSES    = [...MIGRATION_STATUSES, ...LEGAL_STATUSES, 105235463];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const fromParam = searchParams.get('from');
  const toParam   = searchParams.get('to');

  const from = fromParam ? new Date(fromParam) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to   = toParam   ? new Date(toParam)   : new Date();

  const fromMs = from.getTime();
  const toMs   = to.getTime();

  // Leads NUEVOS en el período (por cuándo contactaron)
  const dateFilter = { createdAt: { gte: new Date(fromMs), lte: new Date(toMs) } };

  // Atendidos en el período (por cuándo fueron atendidos = updatedAt)
  // Un lead puede haber llegado hace meses y ser atendido hoy
  const attendedDateFilter = { updatedAt: { gte: new Date(fromMs), lte: new Date(toMs) } };

  // Total leads NUEVOS en el período
  const totalLeads = await prisma.lead.count({ where: dateFilter });

  // Etiquetas: cuántas solicitudes NUEVAS hubo de cada tipo (por createdAt)
  const tagCounts: Record<string, number> = {};
  for (const tagName of BOT_TAGS) {
    tagCounts[tagName] = await prisma.leadTag.count({
      where: { tag: { name: tagName }, lead: dateFilter }
    });
  }

  // En proceso migración: asignados al pipeline pero no cerrados aún
  const enProcesoMigracion = await prisma.lead.count({
    where: { statusId: { in: MIGRATION_EN_PROCESO }, ...attendedDateFilter }
  });
  // Completados migración: cerrados como "migración atendido"
  const completadosMigracion = await prisma.lead.count({
    where: { statusId: { in: MIGRATION_COMPLETADO }, ...attendedDateFilter }
  });
  const atendidosMigracion = enProcesoMigracion + completadosMigracion;

  // En proceso legal: asignados al abogado pero no cerrados aún
  const enProcesoLegal = await prisma.lead.count({
    where: { statusId: { in: LEGAL_EN_PROCESO }, ...attendedDateFilter }
  });
  // Completados legal: cerrados como "abogado atendido"
  const completadosLegal = await prisma.lead.count({
    where: { statusId: { in: LEGAL_COMPLETADO }, ...attendedDateFilter }
  });
  const atendidosLegal = enProcesoLegal + completadosLegal;

  // En espera TOTAL (backlog acumulado, sin filtro de fecha)
  // = leads con el tag PERO que nunca avanzaron a status de atención
  const enEsperaMigracion = await prisma.leadTag.count({
    where: {
      tag: { name: 'asesoriamigracion' },
      lead: { statusId: { notIn: MIGRATION_STATUSES } },
    }
  });

  const enEsperaLegal = await prisma.leadTag.count({
    where: {
      tag: { name: 'asesorialegal' },
      lead: { statusId: { notIn: LEGAL_STATUSES } },
    }
  });

  // Sin atención humana en el período (leads nuevos que siguen sin derivar)
  const sinReplica = await prisma.lead.count({
    where: {
      statusId: { notIn: ATTENDED_STATUSES },
      ...dateFilter,
    }
  });

  // Leads per day for timeline
  const leadsPerDay = await prisma.$queryRaw<Array<{ day: string; count: bigint }>>`
    SELECT
      strftime('%Y-%m-%d', datetime(createdAt / 1000, 'unixepoch')) as day,
      COUNT(*) as count
    FROM Lead
    WHERE createdAt >= ${fromMs} AND createdAt <= ${toMs}
    GROUP BY day
    ORDER BY day ASC
  `;

  const totalInDB = await prisma.lead.count();

  return NextResponse.json({
    period: { from: from.toISOString(), to: to.toISOString() },
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
  });
}
