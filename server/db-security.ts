import { createHmac } from 'crypto';
import { db } from "./db";
import { sql } from "drizzle-orm";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import * as schema from "@shared/schema";

// Type definition for the transaction object
type DbType = typeof db;
// A rough approximation of the transaction type, sufficient for our usage
type TxType = DbType;

function base64url(str: string): string {
    return Buffer.from(str).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

/**
 * Generates a JWT compatible with Supabase Auth (signed with SUPABASE_JWT_SECRET).
 * This allows the frontend or an external client to make API calls to Supabase
 * acting as this user, respecting RLS policies.
 */
export function signSupabaseToken(userId: number): string {
    // Try to find the secret in likely environment variables
    const secret = process.env.SUPABASE_JWT_SECRET || process.env.SUPABASE_SERVICE_KEY;

    if (!secret) {
        throw new Error("SUPABASE_JWT_SECRET (or SUPABASE_SERVICE_KEY) is not set. Cannot sign tokens.");
    }

    // Header: HS256 / JWT
    const header = { alg: 'HS256', typ: 'JWT' };

    const now = Math.floor(Date.now() / 1000);

    // Payload: Standard Supabase claims
    // sub: The user ID (Subject). We use the string representation of the integer ID.
    // role: 'authenticated' is the standard role for logged-in users in Supabase
    const payload = {
        sub: userId.toString(),
        // Include the numeric id as a custom claim as well, just in case policies need it
        user_id: userId,
        role: 'authenticated',
        iat: now,
        exp: now + (60 * 60 * 24 * 7) // 1 week expiry
    };

    const encodedHeader = base64url(JSON.stringify(header));
    const encodedPayload = base64url(JSON.stringify(payload));

    const signature = createHmac('sha256', secret)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Executes a callback within a transaction that has RLS context applied.
 * 
 * This sets the PostgreSQL session variables:
 * - role: 'authenticated'
 * - request.jwt.claim.sub: userId
 * 
 * This ensures that any RLS policies defined on tables will verify this user identity.
 * 
 * @param userId The ID of the user performing the action
 * @param callback A function that receives the transaction (tx) to perform queries
 */
export async function withRLS<T>(
    userId: number,
    callback: (tx: TxType) => Promise<T>
): Promise<T> {
    return await db.transaction(async (tx) => {
        // Switch to authenticated role and set the claiming user
        // The "true" argument makes these settings local to the transaction
        await tx.execute(sql`
      SELECT
        set_config('role', 'authenticated', true),
        set_config('request.jwt.claim.sub', ${userId.toString()}, true)
    `);

        // Execute the user's operation
        // We cast tx to TxType (which matches 'db') because Drizzle's transaction types
        // are compatible with the query interface
        return await callback(tx as unknown as TxType);
    });
}
