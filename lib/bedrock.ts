/**
 * Amazon Bedrock AI — Question Generation
 *
 * Uses static IAM credentials (BEDROCK_ACCESS_KEY_ID / BEDROCK_SECRET_ACCESS_KEY)
 * which are separate from the Vercel OIDC credentials used for DynamoDB/DSQL.
 *
 * Primary model: us.amazon.nova-lite-v1:0 (no approval required)
 * Fallback model: amazon.titan-text-express-v1
 * Final fallback: hardcoded question candidates
 */
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface QuestionCandidate {
  question_text: string;
  category: string;
  predicted_divergence_score: number;
  predicted_high_divergence_reason: string;
  rationale: string;
}

// ---------------------------------------------------------------------------
// Client — lazy singleton with static credentials
// ---------------------------------------------------------------------------
let _client: BedrockRuntimeClient | null = null;

function getClient(): BedrockRuntimeClient {
  if (!_client) {
    _client = new BedrockRuntimeClient({
      region: process.env.BEDROCK_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.BEDROCK_ACCESS_KEY_ID!,
        secretAccessKey: process.env.BEDROCK_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _client;
}

// ---------------------------------------------------------------------------
// Hardcoded fallback questions — always available
// ---------------------------------------------------------------------------
const FALLBACK_QUESTIONS: QuestionCandidate[] = [
  {
    question_text: 'Should governments mandate a four-day work week for all industries?',
    category: 'Economics',
    predicted_divergence_score: 7.5,
    predicted_high_divergence_reason: 'Northern European nations with strong labor rights will support this far more than high-growth Asian economies.',
    rationale: 'Work culture norms vary dramatically between collectivist and individualist societies.',
  },
  {
    question_text: 'Should autonomous vehicles be allowed to operate without a human safety driver?',
    category: 'Technology',
    predicted_divergence_score: 6.8,
    predicted_high_divergence_reason: 'Younger demographics will be significantly more trusting of autonomous technology than those over 50.',
    rationale: 'Generational trust in technology and cultural attitudes toward risk create natural divergence.',
  },
  {
    question_text: 'Should countries be allowed to block social media platforms during elections?',
    category: 'Geopolitics',
    predicted_divergence_score: 8.2,
    predicted_high_divergence_reason: 'Countries with histories of internet censorship will view this differently from those with strong free-speech traditions.',
    rationale: 'The tension between information control and democratic participation splits along geopolitical lines.',
  },
];

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------
function buildPrompt(topic: string, recentQuestions: string[]): string {
  const recentList = recentQuestions.length > 0
    ? recentQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')
    : '(none)';

  return `You are a question designer for Groundswell, a global opinion platform where players predict how different demographic groups worldwide will vote on daily questions.

Generate exactly 5 opinion question candidates about the topic: "${topic}".

Requirements for each question:
- Genuinely debatable with no obvious correct answer
- Likely to produce different responses across cultures and age groups
- Phrased neutrally without leading language
- Not about religion, specific political figures, or violent topics
- Each must be different from these recent questions:
${recentList}

Return a pure JSON array with exactly 5 objects. Each object must have these fields:
- "question_text": the full question as a string
- "category": one of "Technology", "Society", "Economics", "Environment", "Healthcare", "Culture", "Geopolitics"
- "predicted_divergence_score": a number from 1 to 10 where 10 means maximum cultural disagreement expected
- "predicted_high_divergence_reason": one sentence explaining which groups will likely disagree most
- "rationale": one sentence on why this question creates cross-cultural debate

Return ONLY the JSON array. No markdown formatting, no explanation, no code blocks.`;
}

// ---------------------------------------------------------------------------
// Response parser — strips markdown code blocks if present
// ---------------------------------------------------------------------------
function parseJsonFromResponse(raw: string): QuestionCandidate[] | null {
  try {
    // Strip markdown code fences if the model wrapped the JSON
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    // Try to find the JSON array in the response
    const arrayStart = cleaned.indexOf('[');
    const arrayEnd = cleaned.lastIndexOf(']');
    if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
      cleaned = cleaned.slice(arrayStart, arrayEnd + 1);
    }

    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    // Validate each item has required fields
    for (const item of parsed) {
      if (!item.question_text || !item.category) return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Invoke Nova Lite (messages format)
// ---------------------------------------------------------------------------
async function invokeNovaLite(prompt: string): Promise<string> {
  const client = getClient();
  const body = JSON.stringify({
    messages: [
      {
        role: 'user',
        content: [{ text: prompt }],
      },
    ],
    inferenceConfig: {
      maxTokens: 4096,
      temperature: 0.7,
      topP: 0.9,
    },
  });

  const command = new InvokeModelCommand({
    modelId: 'us.amazon.nova-lite-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: new TextEncoder().encode(body),
  });

  const response = await client.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  // Nova Lite response format: { output: { message: { content: [{ text: "..." }] } } }
  const text = responseBody?.output?.message?.content?.[0]?.text
    || responseBody?.results?.[0]?.outputText
    || JSON.stringify(responseBody);

  return text;
}

// ---------------------------------------------------------------------------
// Invoke Titan Text Express (inputText format)
// ---------------------------------------------------------------------------
async function invokeTitan(prompt: string): Promise<string> {
  const client = getClient();
  const body = JSON.stringify({
    inputText: prompt,
    textGenerationConfig: {
      maxTokenCount: 4096,
      temperature: 0.7,
      topP: 0.9,
    },
  });

  const command = new InvokeModelCommand({
    modelId: 'amazon.titan-text-express-v1',
    contentType: 'application/json',
    accept: 'application/json',
    body: new TextEncoder().encode(body),
  });

  const response = await client.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  // Titan response format: { results: [{ outputText: "..." }] }
  const text = responseBody?.results?.[0]?.outputText
    || JSON.stringify(responseBody);

  return text;
}

// ---------------------------------------------------------------------------
// Main export — generate question candidates
// ---------------------------------------------------------------------------
export async function generateQuestionCandidates(
  topic: string,
  recentQuestions: string[],
): Promise<{ candidates: QuestionCandidate[]; model: string; fallback: boolean }> {
  const prompt = buildPrompt(topic, recentQuestions);

  // Attempt 1: Nova Lite
  try {
    console.log('[Bedrock] Attempting us.amazon.nova-lite-v1:0...');
    const raw = await invokeNovaLite(prompt);
    console.log('[Bedrock] Nova Lite raw response length:', raw.length);
    const parsed = parseJsonFromResponse(raw);
    if (parsed) {
      console.log('[Bedrock] Nova Lite returned', parsed.length, 'candidates');
      return { candidates: parsed, model: 'us.amazon.nova-lite-v1:0', fallback: false };
    }
    console.log('[Bedrock] Nova Lite response could not be parsed as JSON, trying Titan...');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Bedrock] Nova Lite failed:', msg);
  }

  // Attempt 2: Titan Text Express
  try {
    console.log('[Bedrock] Attempting amazon.titan-text-express-v1...');
    const raw = await invokeTitan(prompt);
    console.log('[Bedrock] Titan raw response length:', raw.length);
    const parsed = parseJsonFromResponse(raw);
    if (parsed) {
      console.log('[Bedrock] Titan returned', parsed.length, 'candidates');
      return { candidates: parsed, model: 'amazon.titan-text-express-v1', fallback: false };
    }
    console.log('[Bedrock] Titan response could not be parsed as JSON, using fallback...');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Bedrock] Titan failed:', msg);
  }

  // Attempt 3: Hardcoded fallback
  console.log('[Bedrock] All models failed, returning hardcoded fallback questions');
  return { candidates: FALLBACK_QUESTIONS, model: 'fallback', fallback: true };
}
