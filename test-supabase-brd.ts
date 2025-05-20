import { createClient } from '@supabase/supabase-js';

// BRD ID to test
const brdId = 'e4deeab7-3353-4675-9c20-18998295f24b';

// Get Supabase credentials from environment
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_API_KEY environment variables must be set');
  process.exit(1);
}

console.log('Supabase credentials found.');
console.log(`Testing BRD retrieval with ID: ${brdId}`);

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
  try {
    console.log('\nListing tables in Supabase...');
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

async function testBrdRetrieval() {
  // Try approach 1: Direct id lookup
  try {
    console.log('\nApproach 1: Trying direct id match...');
    const { data, error } = await supabase
      .from('brd')
      .select('*')
      .eq('id', brdId)
      .single();
    
    if (error) {
      console.log(`Error with id lookup: ${error.message}`);
    } else {
      console.log('SUCCESS! Found record with direct id match.');
      checkHtmlContent(data, 'id');
      return;
    }
  } catch (err) {
    console.error('Exception during id lookup:', err);
  }
  
  // Try approach 2: reference_id
  try {
    console.log('\nApproach 2: Trying reference_id match...');
    const { data, error } = await supabase
      .from('brd')
      .select('*')
      .eq('reference_id', brdId)
      .single();
    
    if (error) {
      console.log(`Error with reference_id lookup: ${error.message}`);
    } else {
      console.log('SUCCESS! Found record with reference_id match.');
      checkHtmlContent(data, 'reference_id');
      return;
    }
  } catch (err) {
    console.error('Exception during reference_id lookup:', err);
  }
  
  // Try approach 3: uuid
  try {
    console.log('\nApproach 3: Trying uuid match...');
    const { data, error } = await supabase
      .from('brd')
      .select('*')
      .eq('uuid', brdId)
      .single();
    
    if (error) {
      console.log(`Error with uuid lookup: ${error.message}`);
    } else {
      console.log('SUCCESS! Found record with uuid match.');
      checkHtmlContent(data, 'uuid');
      return;
    }
  } catch (err) {
    console.error('Exception during uuid lookup:', err);
  }
  
  // Try approach 4: List all BRD records
  try {
    console.log('\nApproach 4: Listing all BRD records...');
    const { data, error } = await supabase
      .from('brd')
      .select('id, uuid, reference_id')
      .limit(20);
    
    if (error) {
      console.log(`Error listing BRD records: ${error.message}`);
    } else {
      console.log('Available BRD records:');
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('Exception listing BRD records:', err);
  }
}

function checkHtmlContent(data: any, lookupMethod: string) {
  console.log(`\nChecking BRD data found using ${lookupMethod}:`);
  console.log(`Available fields: ${Object.keys(data).join(', ')}`);
  
  // Check common HTML field names
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
      if (typeof value === 'string' && 
          (value.includes('<html') || 
           value.includes('<!DOCTYPE') || 
           value.includes('<div') || 
           value.includes('<p>'))) {
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

async function main() {
  await listTables();
  await testBrdRetrieval();
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});