import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getValidToken(): Promise<string> {
  const auth = await prisma.kommoAuth.findUnique({ where: { id: 1 } });
  if (!auth) throw new Error("No auth");
  return auth.accessToken; // simplificado para el script
}

async function syncLeads() {
  console.log("Iniciando sincronización de Leads desde Kommo...");
  const token = await getValidToken();
  const domain = process.env.KOMMO_DOMAIN;
  
  // Obtener los últimos 250 leads para tener data reciente y real
  const url = `https://${domain}/api/v4/leads?limit=250&order[created_at]=desc&with=tags`;
  
  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!res.ok) {
      console.error("Error al obtener leads:", await res.text());
      return;
    }
    
    const data = await res.json();
    const leads = data._embedded?.leads || [];
    
    console.log(`Encontrados ${leads.length} leads. Guardando en BD...`);
    
    for (const lead of leads) {
      // Guardar el Lead
      const savedLead = await prisma.lead.upsert({
        where: { id: lead.id },
        update: {
          name: lead.name,
          price: lead.price,
          statusId: lead.status_id,
          pipelineId: lead.pipeline_id,
          updatedAt: new Date(lead.updated_at * 1000),
        },
        create: {
          id: lead.id,
          name: lead.name,
          price: lead.price,
          statusId: lead.status_id,
          pipelineId: lead.pipeline_id,
          createdAt: new Date(lead.created_at * 1000),
          updatedAt: new Date(lead.updated_at * 1000),
        }
      });
      
      // Guardar etiquetas
      const tags = lead._embedded?.tags || [];
      for (const tag of tags) {
        await prisma.tag.upsert({
          where: { name: tag.name },
          update: {},
          create: { id: tag.id, name: tag.name }
        });
        
        await prisma.leadTag.upsert({
          where: { leadId_tagId: { leadId: lead.id, tagId: tag.id } },
          update: {},
          create: { leadId: lead.id, tagId: tag.id }
        });
      }
    }
    
    console.log("Sincronización completada con éxito.");
  } catch (error) {
    console.error("Error en sincronización:", error);
  } finally {
    await prisma.$disconnect();
  }
}

syncLeads();
