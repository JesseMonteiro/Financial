import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  // Get all users
  const { data: authData, error: authErr } = await supabase.auth.admin.listUsers();
  if (authErr) {
    console.error('Auth Error:', authErr);
    return;
  }
  
  const users = authData.users;
  console.log(`Found ${users.length} users in auth.users.`);
  
  // Get all profiles
  const { data: profiles, error: profErr } = await supabase.from('profiles').select('id');
  if (profErr) {
    console.error('Profiles Error:', profErr);
    return;
  }
  
  const profileIds = new Set(profiles.map(p => p.id));
  
  const missingProfiles = users.filter(u => !profileIds.has(u.id));
  console.log(`Found ${missingProfiles.length} missing profiles.`);
  
  for (const user of missingProfiles) {
    const { error: insErr } = await supabase.from('profiles').insert([{ id: user.id }]);
    if (insErr) {
      console.error(`Failed to insert profile for ${user.email}:`, insErr);
    } else {
      console.log(`Inserted profile for ${user.email}`);
    }
  }
  console.log('Done.');
}
run();
