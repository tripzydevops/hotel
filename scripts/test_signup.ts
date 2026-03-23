
import { createClient } from '@insforge/sdk';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pa5riyqv.eu-central.insforge.app';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Testing InsForge Client initialization...');
console.log('Base URL:', baseUrl);
console.log('Anon Key Present:', !!anonKey);

const insforge = createClient({
  baseUrl,
  anonKey: anonKey as string,
});

async function testSignup() {
  const email = 'successofmentors@gmail.com';
  const password = 'TestPassword123!'; // Dummy password for testing

  console.log(`Attempting signUp for: ${email}`);
  try {
    const { data, error } = await insforge.auth.signUp({
      email,
      password,
    });

    if (error) {
      console.error('Signup Error:', JSON.stringify(error, null, 2));
    } else {
      console.log('Signup Success:', JSON.stringify(data, null, 2));
    }
  } catch (err: any) {
    console.error('Caught Exception:', err.message);
  }
}

testSignup();
