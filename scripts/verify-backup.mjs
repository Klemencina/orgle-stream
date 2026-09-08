import { PrismaClient } from '@prisma/client'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const path = process.argv[2]
const url = new URL(process.env.RESTORE_DATABASE_URL || 'file:///missing')
if (!path || !['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/orgle_restore_test') {
  throw new Error('Provide a snapshot path and a local RESTORE_DATABASE_URL for the empty orgle_restore_test database')
}
const contents = await readFile(path, 'utf8')
const checksum = (await readFile(`${path}.sha256`, 'utf8')).split(' ')[0]
if (createHash('sha256').update(contents).digest('hex') !== checksum) throw new Error('Snapshot checksum mismatch')
const snapshot = JSON.parse(contents)
if (snapshot.format !== 'orgle-stream-snapshot-v1' || !snapshot.indexes) throw new Error('Unsupported snapshot format')
const quote = (name) => '"' + name.replaceAll('"', '""') + '"'
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
  return value
}
const sortedRows = (rows) => rows.map(row => JSON.stringify(canonical(row))).sort()
const prisma = new PrismaClient({ datasourceUrl: url.toString(), log: [] })
try {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
    if (existing.length) throw new Error('Restore verification requires an empty database. Existing tables will not be changed.')
    for (const [table, rows] of Object.entries(snapshot.data)) {
      const columns = snapshot.columns.filter(column => column.table_name === table)
      const definition = columns.map(column => `${quote(column.column_name)} ${column.sql_type}${column.not_null ? ' NOT NULL' : ''}${column.column_default ? ` DEFAULT ${column.column_default}` : ''}`).join(', ')
      await tx.$executeRawUnsafe(`CREATE TABLE public.${quote(table)} (${definition})`)
      await tx.$executeRawUnsafe(`INSERT INTO public.${quote(table)} SELECT * FROM json_populate_recordset(NULL::public.${quote(table)}, $1::json)`, JSON.stringify(rows))
    }
    // Add referenced keys before foreign keys, after every table exists.
    const constraints = [...snapshot.constraints].sort((a, b) => Number(a.definition.startsWith('FOREIGN KEY')) - Number(b.definition.startsWith('FOREIGN KEY')))
    for (const constraint of constraints) {
      await tx.$executeRawUnsafe(`ALTER TABLE public.${quote(constraint.table_name)} ADD CONSTRAINT ${quote(constraint.name)} ${constraint.definition}`)
    }
    for (const index of snapshot.indexes) {
      if (!constraints.some(constraint => constraint.table_name === index.table_name && constraint.name === index.name)) {
        await tx.$executeRawUnsafe(index.definition)
      }
    }
    for (const [table, original] of Object.entries(snapshot.data)) {
      const rows = await tx.$queryRawUnsafe(`SELECT row_to_json(t) AS row FROM public.${quote(table)} t`)
      if (JSON.stringify(sortedRows(rows.map(({ row }) => row))) !== JSON.stringify(sortedRows(original))) {
        throw new Error(`Restored data differs in ${table}`)
      }
    }
  }, { timeout: 30000 })
  console.log(JSON.stringify({ verified: true, tables: Object.keys(snapshot.data).length }))
} catch (error) {
  console.error('Restore verification failed.', error.code || error.message)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
