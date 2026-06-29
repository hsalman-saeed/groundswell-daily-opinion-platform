/**
 * DynamoDB single-table design — Vercel's managed table
 *
 * Table: aws-dynamodb-groundswell-daily-opinion-platform
 * Partition key: PK (String) — from DYNAMODB_TABLE_PARTITION_KEY
 * Sort key: SK (String) — from DYNAMODB_TABLE_SORT_KEY
 *
 * Two item types coexist in the same table:
 *   VOTE#<question_id> / PLAYER#<player_id>  — individual votes
 *   COUNTER#<question_id> / SEG#<segment>    — atomic counters
 *
 * Authentication: OIDC role assumption via fromWebToken
 * using AWS_ROLE_ARN (DynamoDB-specific role).
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  UpdateCommand,
  GetCommand,
  QueryCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { fromWebToken } from '@aws-sdk/credential-providers';
import { getVercelOidcToken } from '@vercel/oidc';

// ---------------------------------------------------------------------------
// Custom error for duplicate votes
// ---------------------------------------------------------------------------
export class DuplicateVoteError extends Error {
  constructor() {
    super('Player has already voted on this question');
    this.name = 'DuplicateVoteError';
  }
}

// ---------------------------------------------------------------------------
// Client setup — lazy singleton
// ---------------------------------------------------------------------------
let _client: DynamoDBDocumentClient | null = null;

async function getCredentialsProvider() {
  // getVercelOidcToken() reads from x-vercel-oidc-token header in production
  // and falls back to process.env.VERCEL_OIDC_TOKEN in local dev / builds
  const oidcToken = await getVercelOidcToken();

  if (!oidcToken) {
    throw new Error('VERCEL_OIDC_TOKEN is missing. Ensure OIDC federation is enabled in Vercel Project Settings > Security.');
  }

  const oidcProvider = fromWebToken({
    roleArn: process.env.AWS_ROLE_ARN!,
    webIdentityToken: oidcToken,
  });
  return oidcProvider();
}

function createClient(): DynamoDBDocumentClient {
  const baseClient = new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: getCredentialsProvider,
  });
  return DynamoDBDocumentClient.from(baseClient, {
    marshallOptions: { removeUndefinedValues: true },
  });
}

export function getDynamoClient(): DynamoDBDocumentClient {
  if (!_client) _client = createClient();
  return _client;
}

// Expose for imports
export const dynamoClient = { get: getDynamoClient };

// ---------------------------------------------------------------------------
// Table + key config from environment
// ---------------------------------------------------------------------------
const TABLE = () => process.env.DYNAMODB_TABLE_NAME || 'aws-dynamodb-groundswell-daily-opinion-platform';
const PK = () => process.env.DYNAMODB_TABLE_PARTITION_KEY || 'PK';
const SK = () => process.env.DYNAMODB_TABLE_SORT_KEY || 'SK';

// ---------------------------------------------------------------------------
// Key builders
// ---------------------------------------------------------------------------
const voteKey = (questionId: string, playerId: string) => ({
  [PK()]: `VOTE#${questionId}`,
  [SK()]: `PLAYER#${playerId}`,
});

const counterKey = (questionId: string, segment: string) => ({
  [PK()]: `COUNTER#${questionId}`,
  [SK()]: `SEG#${segment}`,
});

// ---------------------------------------------------------------------------
// ITEM TYPE 1 — Individual Vote Records
// ---------------------------------------------------------------------------

/**
 * Check whether a player has already voted on a question.
 */
export async function hasPlayerVoted(
  questionId: string,
  playerId: string,
): Promise<boolean> {
  const client = getDynamoClient();
  const result = await client.send(
    new GetCommand({
      TableName: TABLE(),
      Key: voteKey(questionId, playerId),
    }),
  );
  return !!result.Item;
}

/**
 * Submit a vote: write the vote record and increment all three counters.
 * Throws DuplicateVoteError if the player has already voted.
 */
export async function submitVote(
  questionId: string,
  playerId: string,
  vote: 'YES' | 'NO' | 'ABSTAIN',
  countryCode: string,
  ageBucket: string,
): Promise<void> {
  const client = getDynamoClient();
  const pk = PK();
  const sk = SK();

  // 1. Write individual vote record (conditional — prevent duplicates)
  try {
    await client.send(
      new PutCommand({
        TableName: TABLE(),
        Item: {
          [pk]: `VOTE#${questionId}`,
          [sk]: `PLAYER#${playerId}`,
          item_type: 'vote',
          vote,
          country_code: countryCode,
          age_bucket: ageBucket,
          voted_at: Date.now(),
        },
        ConditionExpression: `attribute_not_exists(${pk}) AND attribute_not_exists(${sk})`,
      }),
    );
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'ConditionalCheckFailedException') {
      throw new DuplicateVoteError();
    }
    throw err;
  }

  // 2. Increment all three segment counters in parallel
  await incrementSegmentCounter(questionId, countryCode, ageBucket, vote);
}

// ---------------------------------------------------------------------------
// ITEM TYPE 2 — Segment Counter Records
// ---------------------------------------------------------------------------

/**
 * Atomically increment three counters in parallel:
 *   1. country segment (country_<code>)
 *   2. age_bucket segment (age_<bucket>)
 *   3. global segment (global_all)
 *
 * Uses DynamoDB's ADD operation — lock-free, correct under concurrency.
 */
export async function incrementSegmentCounter(
  questionId: string,
  countryCode: string,
  ageBucket: string,
  vote: 'YES' | 'NO' | 'ABSTAIN',
): Promise<void> {
  const counterAttr =
    vote === 'YES' ? 'yes_count' : vote === 'NO' ? 'no_count' : 'abstain_count';
  const client = getDynamoClient();

  const buildUpdate = (segment: string) =>
    client.send(
      new UpdateCommand({
        TableName: TABLE(),
        Key: counterKey(questionId, segment),
        UpdateExpression: 'ADD #cnt :inc SET last_updated = :now, item_type = :itype',
        ExpressionAttributeNames: { '#cnt': counterAttr },
        ExpressionAttributeValues: {
          ':inc': 1,
          ':now': Date.now(),
          ':itype': 'counter',
        },
      }),
    );

  await Promise.all([
    buildUpdate(`country_${countryCode}`),
    buildUpdate(`age_${ageBucket}`),
    buildUpdate('global_all'),
  ]);
}

/**
 * Get all segment counter rows for a given question.
 * Returns computed yes_pct and no_pct alongside raw counts.
 */
export async function getSegmentCounters(
  questionId: string,
): Promise<
  {
    segment: string;
    yes_count: number;
    no_count: number;
    abstain_count: number;
    yes_pct: number;
    no_pct: number;
  }[]
> {
  const client = getDynamoClient();
  const result = await client.send(
    new QueryCommand({
      TableName: TABLE(),
      KeyConditionExpression: `${PK()} = :pk AND begins_with(${SK()}, :prefix)`,
      ExpressionAttributeValues: {
        ':pk': `COUNTER#${questionId}`,
        ':prefix': 'SEG#',
      },
    }),
  );

  return (result.Items || []).map((item) => {
    const segment = ((item[SK()] as string) || '').replace('SEG#', '');
    const yes = (item.yes_count as number) || 0;
    const no = (item.no_count as number) || 0;
    const abstain = (item.abstain_count as number) || 0;
    const total = yes + no + abstain;
    return {
      segment,
      yes_count: yes,
      no_count: no,
      abstain_count: abstain,
      yes_pct: total > 0 ? parseFloat(((yes / total) * 100).toFixed(2)) : 0,
      no_pct: total > 0 ? parseFloat(((no / total) * 100).toFixed(2)) : 0,
    };
  });
}

/**
 * Initialize all 16 counter records for a question with specified counts.
 * Uses BatchWriteItem for efficiency. Overwrites existing records.
 */
export async function initializeCountersForQuestion(
  questionId: string,
  counters?: { segment: string; yes_count: number; no_count: number; abstain_count: number }[],
): Promise<number> {
  const pk = PK();
  const sk = SK();
  const client = getDynamoClient();

  // Default: all zeros for the 16 standard segments
  const defaultSegments = [
    'country_DE', 'country_BR', 'country_JP', 'country_PK', 'country_US',
    'country_IN', 'country_GB', 'country_FR', 'country_KR', 'country_NG',
    'age_18-24', 'age_25-34', 'age_35-49', 'age_50-64', 'age_65+',
    'global_all',
  ];

  const items = counters || defaultSegments.map((seg) => ({
    segment: seg,
    yes_count: 0,
    no_count: 0,
    abstain_count: 0,
  }));

  // DynamoDB BatchWrite accepts max 25 items per call
  const batches: typeof items[] = [];
  for (let i = 0; i < items.length; i += 25) {
    batches.push(items.slice(i, i + 25));
  }

  let total = 0;
  for (const batch of batches) {
    await client.send(
      new BatchWriteCommand({
        RequestItems: {
          [TABLE()]: batch.map((s) => ({
            PutRequest: {
              Item: {
                [pk]: `COUNTER#${questionId}`,
                [sk]: `SEG#${s.segment}`,
                item_type: 'counter',
                yes_count: s.yes_count,
                no_count: s.no_count,
                abstain_count: s.abstain_count,
                last_updated: Date.now(),
              },
            },
          })),
        },
      }),
    );
    total += batch.length;
  }
  return total;
}

/**
 * Scan all items in the DynamoDB table with an optional prefix filter.
 * For verification / debugging only.
 */
export async function scanItems(
  pkPrefix?: string,
): Promise<Record<string, unknown>[]> {
  const client = getDynamoClient();
  if (pkPrefix) {
    const result = await client.send(
      new QueryCommand({
        TableName: TABLE(),
        KeyConditionExpression: `${PK()} = :pk`,
        ExpressionAttributeValues: { ':pk': pkPrefix },
      }),
    );
    return (result.Items || []) as Record<string, unknown>[];
  }
  // Full scan (use sparingly)
  const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
  const result = await client.send(new ScanCommand({ TableName: TABLE() }));
  return (result.Items || []) as Record<string, unknown>[];
}
