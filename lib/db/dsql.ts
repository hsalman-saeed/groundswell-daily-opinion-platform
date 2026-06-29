/**
 * Aurora DSQL — PostgreSQL-compatible connection
 *
 * Authentication flow:
 * 1. VERCEL_OIDC_TOKEN (auto-injected by `vercel dev`) is used to
 *    assume the DSQL-specific IAM role via fromWebToken
 * 2. The assumed credentials are used by DsqlSigner to generate a
 *    short-lived DSQL auth token
 * 3. That auth token is used as the PostgreSQL password
 *
 * Uses DSQL_AWS_ROLE_ARN (separate from AWS_ROLE_ARN which is for DynamoDB).
 */
import { Client, type QueryResultRow } from 'pg';
import { DsqlSigner } from '@aws-sdk/dsql-signer';
import { fromWebToken } from '@aws-sdk/credential-providers';
import { getVercelOidcToken } from '@vercel/oidc';
import type { AwsCredentialIdentity } from '@aws-sdk/types';

async function generateTokenWithCredentials(credentials: AwsCredentialIdentity): Promise<string> {
  const hostname = process.env.PGHOST!;
  const region = hostname.split('.dsql.')[1]?.split('.on.aws')[0] || 'us-east-1';

  const signer = new DsqlSigner({
    hostname,
    region,
    credentials,
  });

  return signer.getDbConnectAdminAuthToken();
}

/**
 * Create a connected PG client with a fresh auth token.
 */
async function getClient(): Promise<Client> {
  const hostname = process.env.PGHOST;
  if (!hostname) {
    throw new Error('PGHOST is missing in environment variables. Please check your environment configuration.');
  }
  const port = Number(process.env.PGPORT) || 5432;
  const user = process.env.PGUSER || 'admin';
  const database = process.env.PGDATABASE || 'postgres';

  // getVercelOidcToken() reads from x-vercel-oidc-token header in production
  // and falls back to process.env.VERCEL_OIDC_TOKEN in local dev / builds
  const oidcToken = await getVercelOidcToken();

  if (!oidcToken) {
    throw new Error('VERCEL_OIDC_TOKEN is missing. Ensure OIDC federation is enabled in Vercel Project Settings > Security.');
  }

  const oidcCredsProvider = fromWebToken({
    roleArn: process.env.DSQL_AWS_ROLE_ARN!,
    webIdentityToken: oidcToken,
  });

  const resolvedCredentials = await oidcCredsProvider();
  const token = await generateTokenWithCredentials(resolvedCredentials);
  const client = new Client({
    host: hostname,
    port,
    user,
    password: token,
    database,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}

/**
 * Get client with retry and exponential backoff
 */
async function getClientWithRetry(retries = 3, delayMs = 1000): Promise<Client> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      const client = await getClient();
      return client;
    } catch (err: any) {
      lastError = err;
      console.warn(`[DSQL] Connection attempt ${i + 1} failed: ${err.message}.`);
      if (i < retries - 1) {
        console.log(`[DSQL] Retrying connection in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 2; // exponential backoff
      }
    }
  }
  throw lastError;
}

/**
 * Execute a parameterised SQL query against Aurora DSQL.
 * Creates a fresh client per query to ensure token freshness.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
) {
  const client = await getClientWithRetry();
  try {
    const start = Date.now();
    const result = await client.query<T>(text, params);
    const duration = Date.now() - start;
    console.log('[DSQL] query', { text: text.slice(0, 80), duration, rows: result.rowCount });
    return result;
  } finally {
    await client.end();
  }
}

/**
 * Test the connection with a simple SELECT 1.
 */
export async function testConnection(): Promise<{ connected: boolean; message: string }> {
  try {
    const result = await query('SELECT 1 AS ok');
    if (result.rows[0]?.ok === 1) {
      return { connected: true, message: 'Aurora DSQL connection successful' };
    }
    return { connected: false, message: 'Unexpected SELECT 1 result' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { connected: false, message: `Aurora DSQL connection failed: ${message}` };
  }
}

export default { query, testConnection };
