/**
 * API Route: POST /api/setup/run-all
 *
 * Master setup endpoint — runs schema, DSQL seed, DynamoDB setup,
 * and verification in the correct order. One-click database setup.
 */
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const baseUrl = new URL(request.url).origin;
  const steps: { step: string; status: string; data?: unknown }[] = [];

  // Step 1: Create Aurora DSQL schema (tables + indexes)
  try {
    const schemaRes = await fetch(`${baseUrl}/api/setup/schema`, { method: 'POST' });
    const schemaData = await schemaRes.json();
    steps.push({
      step: 'schema',
      status: schemaData.success ? 'success' : 'failed',
      data: schemaData,
    });
    if (!schemaData.success) {
      return NextResponse.json({ success: false, steps, message: 'Schema creation failed' }, { status: 500 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    steps.push({ step: 'schema', status: 'failed', data: message });
    return NextResponse.json({ success: false, steps }, { status: 500 });
  }

  // Step 2: Seed Aurora DSQL data (must run before DynamoDB to provide question IDs)
  try {
    const seedRes = await fetch(`${baseUrl}/api/setup/seed`, { method: 'POST' });
    const seedData = await seedRes.json();
    steps.push({
      step: 'seed_dsql',
      status: seedData.success ? 'success' : 'failed',
      data: seedData,
    });
    if (!seedData.success) {
      return NextResponse.json({ success: false, steps, message: 'DSQL seed failed' }, { status: 500 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    steps.push({ step: 'seed_dsql', status: 'failed', data: message });
    return NextResponse.json({ success: false, steps }, { status: 500 });
  }

  // Step 3: DynamoDB test + seed (needs question_id from DSQL)
  try {
    const dynamoRes = await fetch(`${baseUrl}/api/setup/dynamo-tables`, { method: 'POST' });
    const dynamoData = await dynamoRes.json();
    steps.push({
      step: 'dynamo_setup',
      status: dynamoData.success ? 'success' : 'failed',
      data: dynamoData,
    });
    if (!dynamoData.success) {
      return NextResponse.json({ success: false, steps, message: 'DynamoDB setup failed' }, { status: 500 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    steps.push({ step: 'dynamo_setup', status: 'failed', data: message });
    return NextResponse.json({ success: false, steps }, { status: 500 });
  }

  // Step 4: Verify everything
  try {
    const verifyRes = await fetch(`${baseUrl}/api/setup/verify`);
    const verifyData = await verifyRes.json();
    steps.push({
      step: 'verify',
      status: verifyData.success ? 'success' : 'failed',
      data: verifyData,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    steps.push({ step: 'verify', status: 'failed', data: message });
  }

  const allSuccess = steps.every((s) => s.status === 'success');
  return NextResponse.json({ success: allSuccess, steps });
}
