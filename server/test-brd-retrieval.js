import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Get Supabase URL and key from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_API_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_API_KEY environment variables must be set');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// BRD ID to test with
const brdId = 'e4deeab7-3353-4675-9c20-18998295f24b';

async function listTables() {
  try {
    console.log('Attempting to list tables in Supabase...');
    const { data, error } = await supabase
      .from('pg_catalog.pg_tables')
      .select('tablename')
      .eq('schemaname', 'public');
    
    if (error) {
      console.error('Error listing tables:', error);
      return;
    }
    
    console.log('Available tables:', data.map(t => t.tablename));
  } catch (err) {
    console.error('Exception while listing tables:', err);
  }
}

async function testBrdRetrieval(id) {
  console.log(`Testing BRD retrieval with ID: ${id}`);
  
  // Approach 1: Try direct lookup by ID
  try {
    console.log('Approach 1: Trying direct id match...');
    const { data, error } = await supabase
      .from('brd')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.log(`Error with id lookup: ${error.message}`);
    } else {
      console.log('Success! Found record with direct id match.');
      logBrdData(data, 'id');
      return;
    }
  } catch (err) {
    console.error('Exception during id lookup:', err);
  }
  
  // Approach 2: Try reference_id
  try {
    console.log('Approach 2: Trying reference_id match...');
    const { data, error } = await supabase
      .from('brd')
      .select('*')
      .eq('reference_id', id)
      .single();
    
    if (error) {
      console.log(`Error with reference_id lookup: ${error.message}`);
    } else {
      console.log('Success! Found record with reference_id match.');
      logBrdData(data, 'reference_id');
      return;
    }
  } catch (err) {
    console.error('Exception during reference_id lookup:', err);
  }
  
  // Approach 3: Try uuid
  try {
    console.log('Approach 3: Trying uuid match...');
    const { data, error } = await supabase
      .from('brd')
      .select('*')
      .eq('uuid', id)
      .single();
    
    if (error) {
      console.log(`Error with uuid lookup: ${error.message}`);
    } else {
      console.log('Success! Found record with uuid match.');
      logBrdData(data, 'uuid');
      return;
    }
  } catch (err) {
    console.error('Exception during uuid lookup:', err);
  }
  
  // Approach 4: Try partial match (for debugging)
  try {
    console.log('Approach 4: Trying to list all BRD records...');
    const { data, error } = await supabase
      .from('brd')
      .select('id, uuid, reference_id')
      .limit(10);
    
    if (error) {
      console.log(`Error listing BRD records: ${error.message}`);
    } else {
      console.log('Available BRD records:');
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('Exception listing BRD records:', err);
  }
  
  console.log('All approaches failed to find the BRD record.');
}

function logBrdData(data, method) {
  console.log(`\nFound BRD using ${method}:`);
  console.log(`Fields: ${Object.keys(data).join(', ')}`);
  
  // Look for HTML content in possible fields
  const htmlFields = ['brd_html', 'html', 'content'];
  let foundHtml = false;
  
  for (const field of htmlFields) {
    if (data[field] && typeof data[field] === 'string') {
      console.log(`\nFound HTML content in field '${field}'`);
      console.log(`Length: ${data[field].length} characters`);
      console.log(`Preview: ${data[field].substring(0, 200)}...`);
      foundHtml = true;
      break;
    }
  }
  
  if (!foundHtml) {
    console.log('\nNo HTML content found in common fields. Checking all string fields:');
    
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string' && value.includes('<')) {
        console.log(`\nFound potential HTML in field '${key}'`);
        console.log(`Length: ${value.length} characters`);
        console.log(`Preview: ${value.substring(0, 200)}...`);
        foundHtml = true;
      }
    }
    
    if (!foundHtml) {
      console.log('No HTML content found in any field.');
    }
  }
}

async function run() {
  await listTables();
  await testBrdRetrieval(brdId);
}

run().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});