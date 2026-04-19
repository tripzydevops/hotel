const { createClient } = require('@insforge/sdk');
require('dotenv').config({ path: '.env.local' });

const client = createClient({
  baseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
});

async function test() {
  const { data, error } = await client.from('hotel_directory').select('id, location').limit(1);
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success:', data);
  }
}

test();
