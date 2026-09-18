import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function syncWithContactTags() {
  const auth = await prisma.kommoAuth.findUnique({ where: { id: 1 } });
  if (!auth) { console.error("No auth"); return; }
  
  const domain = process.env.KOMMO_DOMAIN;
  const headers = { 'Authorization': `Bearer ${auth.accessToken}` };
  
  console.log("Sincronizando leads con etiquetas de contacto...");
  
  // First, ensure all bot tags exist in DB
  const botTags = [
    { id: 206641, name: 'asesoriamigracion' },
    { id: 209939, name: 'certificados' },
    { id: 209941, name: 'renovaciones' },
    { id: 209945, name: 'mitaciones' },
    { id: 209949, name: 'tramites' },
    { id: 209951, name: 'tunegocio' },
    { id: 209953, name: 'infogeneral' },
    { id: 216983, name: 'asesorialegal' },
  ];
  
  for (const tag of botTags) {
    await prisma.tag.upsert({
      where: { name: tag.name },
      update: {},
      create: { id: tag.id, name: tag.name }
    });
  }
  
  // Delete existing lead tags so we start fresh with correct data
  await prisma.leadTag.deleteMany({});
  await prisma.lead.deleteMany({});
  console.log("DB limpiada, comenzando sincronización...");
  
  let page = 1;
  let totalSynced = 0;
  let hasMore = true;
  
  while (hasMore && page <= 40) { // up to 40 pages = 10,000 leads
    const res = await fetch(
      `https://${domain}/api/v4/leads?limit=250&page=${page}&with=contacts&order[created_at]=desc`,
      { headers }
    );
    
    if (!res.ok) {
      console.error(`Error fetching page ${page}:`, await res.text());
      break;
    }
    
    const data = await res.json();
    const leads = data._embedded?.leads || [];
    
    if (leads.length === 0) { hasMore = false; break; }
    
    // Collect contact IDs
    const contactIdsMap: Record<number, number> = {}; // leadId -> contactId
    leads.forEach((lead: any) => {
      const contacts = lead._embedded?.contacts || [];
      if (contacts.length > 0) {
        contactIdsMap[lead.id] = contacts[0].id;
      }
    });
    
    const contactIds = Object.values(contactIdsMap);
    
    // Batch-fetch contacts with tags (max 50 at a time)
    const contactTagsMap: Record<number, Array<{id: number, name: string}>> = {};
    
    for (let i = 0; i < contactIds.length; i += 50) {
      const batch = contactIds.slice(i, i + 50);
      const filterStr = batch.map(id => `filter[id][]=${id}`).join('&');
      const cr = await fetch(
        `https://${domain}/api/v4/contacts?limit=50&with=tags&${filterStr}`,
        { headers }
      );
      
      if (cr.ok) {
        const cd = await cr.json();
        const contacts = cd._embedded?.contacts || [];
        contacts.forEach((c: any) => {
          contactTagsMap[c.id] = c._embedded?.tags || [];
        });
      }
    }
    
    // Save leads and their contact tags
    for (const lead of leads) {
      await prisma.lead.upsert({
        where: { id: lead.id },
        update: {
          name: lead.name,
          price: lead.price || 0,
          statusId: lead.status_id,
          pipelineId: lead.pipeline_id,
          updatedAt: new Date(lead.updated_at * 1000),
        },
        create: {
          id: lead.id,
          name: lead.name,
          price: lead.price || 0,
          statusId: lead.status_id,
          pipelineId: lead.pipeline_id,
          createdAt: new Date(lead.created_at * 1000),
          updatedAt: new Date(lead.updated_at * 1000),
        }
      });
      
      // Get contact tags for this lead
      const contactId = contactIdsMap[lead.id];
      if (contactId) {
        const contactTags = contactTagsMap[contactId] || [];
        const botTagNames = botTags.map(t => t.name);
        
        for (const tag of contactTags) {
          if (botTagNames.includes(tag.name)) {
            try {
              await prisma.leadTag.create({
                data: { leadId: lead.id, tagId: tag.id }
              });
            } catch (e) {
              // ignore duplicates
            }
          }
        }
      }
    }
    
    totalSynced += leads.length;
    console.log(`Página ${page}: ${leads.length} leads, total=${totalSynced}`);
    
    hasMore = data._links?.next ? true : false;
    page++;
  }
  
  console.log(`\nSincronización completa: ${totalSynced} leads`);
  
  // Show stats
  const stats = await prisma.$queryRaw<any[]>`
    SELECT t.name, COUNT(lt.leadId) as count
    FROM Tag t
    JOIN LeadTag lt ON t.id = lt.tagId
    GROUP BY t.id, t.name
    ORDER BY count DESC
  `;
  console.log('\nEtiquetas encontradas:');
  stats.forEach((s: any) => console.log(`  ${s.name}: ${Number(s.count)}`));
  
  const totalLeads = await prisma.lead.count();
  console.log(`\nTotal leads en DB: ${totalLeads}`);
  
  await prisma.$disconnect();
}

syncWithContactTags();
