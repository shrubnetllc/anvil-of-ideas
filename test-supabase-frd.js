// Test script to directly verify FRD data in Supabase
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_API_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
  try {
    console.log('Attempting to list some tables in Supabase...');
    
    // Try to query frd table
    const { data: frdData, error: frdError } = await supabase
      .from('frd')
      .select('id')
      .limit(5);
    
    if (frdError) {
      console.error('Error accessing frd table:', frdError.message);
    } else {
      console.log('Found frd records:', frdData.length);
      console.log('Sample IDs:', frdData.map(r => r.id).join(', '));
    }
    
    // Try to query functional_requirements table as fallback
    const { data: funcData, error: funcError } = await supabase
      .from('functional_requirements')
      .select('id')
      .limit(5);
    
    if (funcError) {
      console.error('Error accessing functional_requirements table:', funcError.message);
    } else if (funcData) {
      console.log('Found functional_requirements records:', funcData.length);
      console.log('Sample IDs:', funcData.map(r => r.id).join(', '));
    }
  } catch (err) {
    console.error('General error listing tables:', err);
  }
}

async function testFrdRetrieval(id) {
  if (!id) {
    console.error('Please provide an ID to test');
    return;
  }
  
  console.log(`Testing FRD retrieval with ID: ${id}`);
  
  try {
    // First try the frd table
    const { data: frdData, error: frdError } = await supabase
      .from('frd')
      .select('*')
      .eq('id', id)
      .single();
    
    if (frdError) {
      console.log(`Error querying frd table with id=${id}:`, frdError.message);
    } else if (frdData) {
      console.log('✅ Found record in frd table!');
      logFrdData(frdData, 'frd.id');
      return;
    }
    
    // Try with project_id field
    const { data: projectData, error: projectError } = await supabase
      .from('frd')
      .select('*')
      .eq('project_id', id)
      .single();
    
    if (projectError) {
      console.log(`Error querying frd table with project_id=${id}:`, projectError.message);
    } else if (projectData) {
      console.log('✅ Found record in frd table using project_id!');
      logFrdData(projectData, 'frd.project_id');
      return;
    }
    
    // Try the functional_requirements table as fallback
    const { data: funcData, error: funcError } = await supabase
      .from('functional_requirements')
      .select('*')
      .eq('id', id)
      .single();
    
    if (funcError) {
      console.log(`Error querying functional_requirements table with id=${id}:`, funcError.message);
    } else if (funcData) {
      console.log('✅ Found record in functional_requirements table!');
      logFrdData(funcData, 'functional_requirements.id');
      return;
    }
    
    console.log('❌ No record found with ID:', id);
  } catch (err) {
    console.error('Unexpected error testing FRD retrieval:', err);
  }
}

function logFrdData(data, method) {
  console.log(`\n==== FRD DATA FOUND USING ${method} ====`);
  console.log('Available fields:', Object.keys(data).join(', '));
  
  // Check for content in frd_html field
  if (data.frd_html) {
    console.log('\n✅ Found HTML content in frd_html field!');
    console.log(`Length: ${data.frd_html.length} characters`);
    console.log('Sample:', data.frd_html.substring(0, 100) + '...');
  } else {
    console.log('\n❌ No frd_html field found');
  }
  
  // Check for content in html field
  if (data.html) {
    console.log('\n✅ Found HTML content in html field!');
    console.log(`Length: ${data.html.length} characters`);
    console.log('Sample:', data.html.substring(0, 100) + '...');
  } else {
    console.log('\n❌ No html field found');
  }
  
  // Check for content in func_html field
  if (data.func_html) {
    console.log('\n✅ Found HTML content in func_html field!');
    console.log(`Length: ${data.func_html.length} characters`);
    console.log('Sample:', data.func_html.substring(0, 100) + '...');
  } else {
    console.log('\n❌ No func_html field found');
  }
  
  // Check for any field that looks like HTML
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' && 
        (value.includes('<html') || 
         value.includes('<!DOCTYPE') || 
         value.includes('<body') ||
         value.includes('<div') || 
         value.includes('<p>'))) {
      if (key !== 'html' && key !== 'frd_html' && key !== 'func_html') {
        console.log(`\n✅ Found potential HTML content in field: ${key}!`);
        console.log(`Length: ${value.length} characters`);
        console.log('Sample:', value.substring(0, 100) + '...');
      }
    }
  }
}

async function run() {
  console.log('Connecting to Supabase...');
  
  // First, list available tables
  await listTables();
  
  // Use the argument as ID if provided, otherwise use a default test ID
  const testId = process.argv[2] || 'b270c91e-92a6-4a0b-8eac-8eec7f3b363c'; // Example - replace with real ID
  
  await testFrdRetrieval(testId);
  
  console.log('\nTest completed');
}

run();