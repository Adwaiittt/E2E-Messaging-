import initSqlJs, { Database, SqlJsStatic } from 'sql.js'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

let _db: Database | null = null
let _dbPath = ''
let _SQL: SqlJsStatic | null = null

export interface DBKey {
  key: string
  salt: Buffer
}

async function getSql(): Promise<SqlJsStatic> {
  if (_SQL) return _SQL
  // Point to the sql.js WASM file bundled with the package
  const wasmPath = path.join(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm')
  _SQL = await initSqlJs({ locateFile: () => wasmPath })
  return _SQL
}

/** Derive DB encryption key from PIN using scrypt */
export async function deriveDatabaseKey(pin: string, salt?: Buffer): Promise<DBKey> {
  const useSalt = salt ?? crypto.randomBytes(16)
  const rawKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(pin, useSalt, 32, { N: 16384, r: 8, p: 1 }, (err, key) => {
      if (err) reject(err)
      else resolve(key)
    })
  })
  return { key: rawKey.toString('hex'), salt: useSalt }
}

export async function openDatabase(dbPath: string): Promise<Database> {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  _dbPath = dbPath

  const SQL = await getSql()
  let data: Buffer | undefined
  if (fs.existsSync(dbPath)) {
    data = fs.readFileSync(dbPath)
  }
  _db = new SQL.Database(data)
  return _db
}

/** Persist in-memory DB to disk (call after every write) */
export function persistDatabase(): void {
  if (!_db || !_dbPath) return
  const data = _db.export()
  fs.writeFileSync(_dbPath, Buffer.from(data))
}

export function getDatabase(): Database {
  if (!_db) throw new Error('Database not initialized')
  return _db
}

export function closeDatabase(): void {
  try { persistDatabase() } catch {}
  _db?.close()
  _db = null
}

/** Helper: run a SQL statement that returns no rows */
export function dbRun(sql: string, params: any[] = []): void {
  getDatabase().run(sql, params)
  persistDatabase()
}

/** Helper: run a query and return all rows as objects */
export function dbAll(sql: string, params: any[] = []): any[] {
  const stmt = getDatabase().prepare(sql)
  stmt.bind(params)
  const rows: any[] = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject())
  }
  stmt.free()
  return rows
}

/** Helper: run query and return first row or null */
export function dbGet(sql: string, params: any[] = []): any | null {
  const rows = dbAll(sql, params)
  return rows[0] ?? null
}
