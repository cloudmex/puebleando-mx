/**
 * Deletes all places from Supabase whose ID does NOT start with "denue-".
 * Run with: npx tsx scripts/reset-non-denue.ts
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { getSupabaseServerClient } from '../lib/supabase-server';

async function main() {
  const sb = getSupabaseServerClient(true);
  if (!sb) {
    console.error('No Supabase client — check env vars.');
    process.exit(1);
  }

  // Count first
  const { count: total } = await sb.from('places').select('*', { count: 'exact', head: true });
  const { count: denue } = await sb.from('places').select('*', { count: 'exact', head: true }).like('id', 'denue-%');
  const toDelete = (total ?? 0) - (denue ?? 0);

  console.log(`Total places   : ${total}`);
  console.log(`DENUE places   : ${denue}  ← se conservan`);
  console.log(`Non-DENUE      : ${toDelete}  ← se borran`);

  if (toDelete === 0) {
    console.log('Nada que borrar.');
    process.exit(0);
  }

  // Sample before deleting
  const { data: samples } = await sb
    .from('places')
    .select('id, name, town')
    .not('id', 'like', 'denue-%')
    .limit(5);
  console.log('\nMuestra de lo que se borrará:');
  samples?.forEach(p => console.log(`  ${p.id}  ${p.name}  (${p.town})`));

  // Delete
  console.log('\nBorrando...');
  const { error } = await sb.from('places').delete().not('id', 'like', 'denue-%');
  if (error) {
    console.error('Error al borrar:', error.message);
    process.exit(1);
  }

  const { count: remaining } = await sb.from('places').select('*', { count: 'exact', head: true });
  console.log(`Listo. Lugares restantes: ${remaining} (todos DENUE)`);
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
