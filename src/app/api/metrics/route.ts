import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

// Migration attended statuses
const MIGRATION_STATUSES = [105235459, 105235467]; // 'migración' y 'migración atendido'
// Leads without human reply (still in initial contact status)
const SIN_REPLICA_STATUS = 105235455; // 'Contacto inicial'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  const from = fromParam ? new Date(fromParam) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = toParam ? new Date(toParam) : new Date();

  // Convert dates to millisecond timestamps for SQLite comparison
  const fromMs = from.getTime();
  const toMs = to.getTime();

  // Total leads in range
  const totalLeads = await prisma.lead.count({
    where: { createdAt: { gte: new Date(fromMs), lte: new Date(toMs) } }
  });

  // Tag counts in range
  const tagCounts: Record<string, number> = {};
  for (const tagName of BOT_TAGS) {
    const count = await prisma.leadTag.count({
      where: {
        tag: { name: tagName },
        lead: {
          createdAt: { gte: new Date(fromMs), lte: new Date(toMs) }
        }
      }
    });
    tagCounts[tagName] = count;
  }

  // Atendidos migración
  const atendidosMigracion = await prisma.lead.count({
    where: {
      statusId: { in: MIGRATION_STATUSES },
      createdAt: { gte: new Date(fromMs), lte: new Date(toMs) }
    }
  });

  // Diálogos sin réplica (leads en estado "Contacto inicial" - sin atención humana)
  const sinReplica = await prisma.lead.count({
    where: {
      statusId: SIN_REPLICA_STATUS,
      createdAt: { gte: new Date(fromMs), lte: new Date(toMs) }
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

  // Total in DB (all time approximation)
  const totalInDB = await prisma.lead.count();

  return NextResponse.json({
    period: { from: from.toISOString(), to: to.toISOString() },
    totalLeads,
    atendidosMigracion,
    sinReplica,
    tagCounts,
    leadsPerDay: leadsPerDay.map(r => ({ day: r.day, count: Number(r.count) })),
    totalInDB,
  });
}
