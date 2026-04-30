import { openDatabase } from './database'
import { runMigrations } from './migrations'

async function test() {
  try {
    await openDatabase('test.db')
    runMigrations()
    console.log('Success')
  } catch (e) {
    console.error('Failed:', e)
  }
}
test()
