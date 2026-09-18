/**
 * Migra datos de SQLite local → Turso (cloud)
 * Uso: TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npx tsx scripts/migrate-to-turso.ts
 */
import { PrismaClient } from '@prisma/client';
import { createClient } from '@libsql/client';

const localDb = new PrismaClient();

async function main() {
  const url       = process.env.TURSO_DATABASE_URL!;
  const authToken = process.env.TURSO_AUTH_TOKEN!;

  if (!url || !authToken) {
    console.error('Faltan TURSO_DATABASE_URL y TURSO_AUTH_TOKEN');
    process.exit(1);
  }

  const turso = createClient({ url, authToken });

  console.log('Creando schema en Turso...');
  await turso.executeMultiple(`
    CREATE TABLE IF NOT EXISTS KommoAuth (
      id INTEGER PRIMARY KEY DEFAULT 1,
      accessToken TEXT NOT NULL,
      refreshToken TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS Tag (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS Lead (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      statusId INTEGER NOT NULL,
      pipelineId INTEGER NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      responseTime INTEGER
    );
    CREATE TABLE IF NOT EXISTS LeadTag (
      leadId INTEGER NOT NULL,
      tagId INTEGER NOT NULL,
      PRIMARY KEY (leadId, tagId),
      FOREIGN KEY (leadId) REFERENCES Lead(id),
      FOREIGN KEY (tagId) REFERENCES Tag(id)
    );
  `);

  // Tags
  const tags = await localDb.tag.findMany();
  console.log(`Migrando ${tags.length} tags...`);
  for (const tag of tags) {
    await turso.execute({
      sql: 'INSERT OR IGNORE INTO Tag (id, name) VALUES (?, ?)',
      args: [tag.id, tag.name],
    });
  }

  // Leads
  const total = await localDb.lead.count();
  console.log(`Migrando ${total} leads...`);
  const BATCH = 200;
  let skip = 0;
  while (skip < total) {
    const leads = await localDb.lead.findMany({ skip, take: BATCH });
    for (const lead of leads) {
      await turso.execute({
        sql: `INSERT OR IGNORE INTO Lead (id, name, price, statusId, pipelineId, createdAt, updatedAt, responseTime)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          lead.id, lead.name, lead.price, lead.statusId, lead.pipelineId,
          lead.createdAt.getTime(), lead.updatedAt.getTime(), lead.responseTime ?? null,
        ],
      });
    }
    skip += BATCH;
    process.stdout.write(`  ${Math.min(skip, total)}/${total}\r`);
  }

  // LeadTags
  const leadTags = await localDb.leadTag.findMany();
  console.log(`\nMigrando ${leadTags.length} lead-tags...`);
  for (const lt of leadTags) {
    await turso.execute({
      sql: 'INSERT OR IGNORE INTO LeadTag (leadId, tagId) VALUES (?, ?)',
      args: [lt.leadId, lt.tagId],
    });
  }

  console.log('✅ Migración completada.');
  await localDb.$disconnect();
  turso.close();
}

main().catch(e => { console.error(e); process.exit(1); });
