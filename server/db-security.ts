import { createHmac } from 'crypto';
import { db } from "./db";
import { sql } from "drizzle-orm";
import * as schema from "@shared/schema";

type DbType = typeof db;
type TxType = DbType;

function base64url(str: string): string {
    return Buffer.from(str).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

/**
 * Generates a JWT compatible with Supabase Auth (signed with SUPABASE_JWT_SECRET).
 */
export function signSupabaseToken(userId: string): string {
    const secret = process.env.SUPABASE_JWT_SECRET || process.env.SUPABASE_SERVICE_KEY;

    if (!secret) {
        throw new Error("SUPABASE_JWT_SECRET (or SUPABASE_SERVICE_KEY) is not set. Cannot sign tokens.");
    }

    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);

    const payload = {
        sub: userId,
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
 */
export async function withRLS<T>(
    userId: string,
    callback: (tx: TxType) => Promise<T>
): Promise<T> {
    return await db.transaction(async (tx) => {
        await tx.execute(sql`
      SELECT
        set_config('role', 'authenticated', true),
        set_config('request.jwt.claim.sub', ${userId}, true)
    `);
        return await callback(tx as unknown as TxType);
    });
}
