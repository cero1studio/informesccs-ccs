import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const leads = await prisma.lead.findMany({
    orderBy: { id: 'desc' },
    include: {
      tags: { include: { tag: true } }
    },
    take: 5
  });

  console.log("Muestra de 5 Leads en BD:");
  leads.forEach(l => {
    console.log(`- Lead ID: ${l.id}, Estado: ${l.statusId}, Pipeline: ${l.pipelineId}`);
    console.log(`  Etiquetas: ${l.tags.map(t => t.tag.name).join(', ')}`);
  });

  const allTags = await prisma.tag.findMany();
  console.log("\nTodas las etiquetas en la BD:");
  console.log(allTags.map(t => t.name).join(', '));
}

main().finally(() => prisma.$disconnect());
