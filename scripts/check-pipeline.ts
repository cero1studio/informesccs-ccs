import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const auth = await prisma.kommoAuth.findUnique({ where: { id: 1 } });
  if (!auth) return;
  const domain = process.env.KOMMO_DOMAIN;
  const headers = { 'Authorization': `Bearer ${auth.accessToken}` };
  
  const res = await fetch(`https://${domain}/api/v4/leads/pipelines/13636179`, { headers });
  const data = await res.json();
  
  console.log("Pipeline:", data.name);
  const statuses = data._embedded?.statuses || [];
  statuses.forEach((s: any) => console.log(`  Status ${s.id}: "${s.name}"`));
  
  await prisma.$disconnect();
}
run();
