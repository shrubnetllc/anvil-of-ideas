
import fs from 'fs';
import path from 'path';
import { pool } from '../server/db';

async function applyRLS() {
    const sqlPath = 'sql/enable_rls.sql';
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Applying RLS policies...');
    try {
        // Drop existing policies first to avoid conflict? 
        // Or just run. If error "policy already exists", we can ignore or let it fail.
        // We will just run it.
        await pool.query(sql);
        console.log('Successfully applied RLS policies.');
    } catch (error) {
        console.error('Error applying RLS policies:', error);
    } finally {
        await pool.end();
    }
}

applyRLS();
