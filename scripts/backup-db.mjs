import { PrismaClient } from '@prisma/client'
import { mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')

const directory = resolve(process.argv[2] || join(homedir(), 'backups', 'orgle-stream'))
await mkdir(directory, { recursive: true, mode: 0o700 })
const prisma = new PrismaClient({ log: [] })
try {
  const snapshot = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
    const tables = await tx.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name")
    const columns = await tx.$queryRawUnsafe("SELECT c.relname::text AS table_name, a.attname::text AS column_name, format_type(a.atttypid, a.atttypmod) AS sql_type, a.attnotnull AS not_null, pg_get_expr(d.adbin, d.adrelid) AS column_default FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped ORDER BY c.relname, a.attnum")
    const constraints = await tx.$queryRawUnsafe("SELECT c.relname AS table_name, con.conname AS name, pg_get_constraintdef(con.oid) AS definition FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' ORDER BY c.relname, con.conname")
    const indexes = await tx.$queryRawUnsafe("SELECT tablename AS table_name, indexname AS name, indexdef AS definition FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname")
    const data = {}
    for (const { table_name: table } of tables) {
      const quoted = '"' + table.replaceAll('"', '""') + '"'
      const rows = await tx.$queryRawUnsafe(`SELECT row_to_json(t) AS row FROM public.${quoted} t`)
      data[table] = rows.map(({ row }) => row)
    }
    return { format: 'orgle-stream-snapshot-v1', createdAt: new Date().toISOString(), columns, constraints, indexes, data }
  }, { isolationLevel: 'RepeatableRead', timeout: 15000 })
  const contents = JSON.stringify(snapshot, null, 2) + '\n'
  const path = join(directory, `snapshot-${snapshot.createdAt.replaceAll(':', '-')}.json`)
  await writeFile(path, contents, { flag: 'wx', mode: 0o600 })
  const sha256 = createHash('sha256').update(contents).digest('hex')
  await writeFile(`${path}.sha256`, `${sha256}  ${path.split('/').at(-1)}\n`, { flag: 'wx', mode: 0o600 })
  console.log(JSON.stringify({ path, sha256, counts: Object.fromEntries(Object.entries(snapshot.data).map(([table, rows]) => [table, rows.length])) }, null, 2))
} catch (error) {
  console.error('Backup failed.', error.code || error.name)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
