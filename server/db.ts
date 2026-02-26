import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import dotenv from 'dotenv';
dotenv.config({ path: process.env.NODE_ENV === 'development' ? '.env.development' : '.env' });
import * as schema from "@shared/schema";

// Configure WebSocket for Node.js environment (required when running in Docker/server)                                                            
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create a connection pool to the database
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create a drizzle instance for the database
export const db = drizzle(pool, { schema });
