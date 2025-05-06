import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables if needed
config();

// Initialize Supabase client with environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL and API key must be provided');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
  console.log('Listing all tables in Supabase...');
  const { data, error } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public');
  
  if (error) {
    console.error('Error fetching tables:', error);
    return;
  }
  
  console.log('Available tables:', data);
}

async function inspectLeanCanvas() {
  console.log('\nTrying to inspect lean_canvas table...');
  const { data, error } = await supabase
    .from('lean_canvas')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('Error fetching from lean_canvas:', error);
    return;
  }
  
  console.log('Sample data from lean_canvas:', data);
  if (data && data.length > 0) {
    console.log('Column names:', Object.keys(data[0]));
  }
}

async function run() {
  try {
    await listTables();
    await inspectLeanCanvas();
  } catch (error) {
    console.error('Error:', error);
  }
}

run();
