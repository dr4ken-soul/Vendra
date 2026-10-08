/**
 * Grounded answer generation.
 *
 * The model is given ONLY facts that already resolved to a canonical deal event
 * inside the authenticated shop. It is instructed to refuse anything the
 * supplied records do not support. If the model is unavailable, Vendra still
 * returns the real sources plus a deterministic summary, so the retailer is
 * never left with an invented answer.
 *
 * Threat model reference: PRIVACY_SECURITY.md section 6 ("Hallucinated supplier
 * fact", "Accidental raw-data exposure to an LLM").
 */

import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { modelEnv } from '@/lib/env';
import type { RecallSource } from '@/lib/types';

export interface GroundedAnswer {
  answer: string;
  grounded: boolean;
  /** True when the model ran. False means a deterministic fallback was used. */
  modelUsed: boolean;
  modelId: string | null;
  /** Which sources the answer actually leans on. */
  sourceEventIds: string[];
  /** Set when the answer could not be generated at all. */
  failureReason: string | null;
}

export const NO_RECORD_ANSWER =
  'I couldn’t find a saved record for that. Try another supplier, item or date.';

/**
 * Render canonical records into a compact, unambiguous block.
 *
 * Only confirmed numbers are emitted. A missing value is written as "not
 * recorded" so the model cannot infer a number from an absent field.
 */
export function renderSourceContext(sources: RecallSource[]): string {
  return sources
    .map((source, index) => {
      const lines = source.lines
        .map((line) => {
          const qty = line.agreedQuantity ?? line.quotedQuantity;
          const price = line.agreedUnitPrice ?? line.quotedUnitPrice;
          const parts: string[] = [`item "${line.productLabel}"`];
          if (qty !== null) parts.push(`quantity ${qty}${line.unitLabel ? ` ${line.unitLabel}` : ''}`);
          if (price !== null) parts.push(`price ${price} ${source.currencyCode}`);
          if (line.receivedQuantity !== null) parts.push(`received ${line.receivedQuantity}`);
          else parts.push('received not recorded');
          return `- ${parts.join(', ')}`;
        })
        .join('\n');

      const evidence = source.evidence.length
        ? source.evidence.map((e) => e.originalFilename).join(', ')
        : 'none attached';

      return [
        `SOURCE ${index + 1}`,
        `deal_id: ${source.dealId}`,
        `event_id: ${source.eventId}`,
        `supplier: ${source.supplierName}`,
        `deal_date: ${source.dealDate}`,
        `event_type: ${source.eventType}`,
        `event_date: ${source.occurredAt.slice(0, 10)}`,
        `headline: ${source.headline ?? 'not recorded'}`,
        `recorded_summary: ${source.summary}`,
        `currency: ${source.currencyCode}`,
        `items:`,
        lines || '- no line items recorded',
        `evidence_files: ${evidence}`,
      ].join('\n');
    })
    .join('\n\n');
}

const SYSTEM_PROMPT = `You are the recall assistant inside Vendra, a private supplier-deal memory used by independent retailers.

You will be given a question and a set of SUPPLIED RECORDS. The records are the canonical, retailer-confirmed history of one shop.

Rules you must follow without exception:
1. Use ONLY facts present in the SUPPLIED RECORDS. Never use general knowledge about a supplier, an item, a price, a date or an outcome.
2. Never infer, estimate, average or round a number that is not written in the records. If a value is missing, say it was not recorded.
3. Never invent a deal, event or file reference.
4. If the records do not answer the question, say so plainly and suggest a supplier, item or date the retailer could try.
5. Do not mention suppliers' phone numbers, the words Walrus, Sui, blockchain, LLM, model or AI. The retailer is not reading infrastructure terms.
6. Do not advise on pricing strategy, recommend a purchase, or claim a supplier is good or bad.
7. Write in plain British English, short sentences, no headings, maximum 160 words.
8. Cite the source numbers you used, for example "According to SOURCE 2".`;

function buildUserPrompt(question: string, sources: RecallSource[]): string {
  const context = renderSourceContext(sources);
  return `SUPPLIED RECORDS
${context}

QUESTION
${question}

Answer using only the SUPPLIED RECORDS. Cite SOURCE numbers. If the records do not contain the answer, say that no saved record was found.`;
}

/**
 * Produce an answer grounded in canonical records.
 */
export async function answerFromSources(input: {
  question: string;
  sources: RecallSource[];
}): Promise<GroundedAnswer> {
  const sourceEventIds = input.sources.map((s) => s.eventId);

  // Nothing recalled and nothing found: say so explicitly. Never guess.
  if (input.sources.length === 0) {
    return {
      answer: NO_RECORD_ANSWER,
      grounded: false,
      modelUsed: false,
      modelId: null,
      sourceEventIds: [],
      failureReason: null,
    };
  }

  const env = modelEnv();

  if (!env) {
    // No model key. Still show the retailer the real records and a
    // deterministic reading of them, clearly labelled as not a model answer.
    return {
      answer: `${deterministicSummary(input.sources)}\n\n(Answer generated from your saved records. The assistant model is not configured in this environment.)`,
      grounded: true,
      modelUsed: false,
      modelId: null,
      sourceEventIds,
      failureReason: null,
    };
  }

  try {
    const result = await generateText({
      model: google(env.modelId),
      system: SYSTEM_PROMPT,
      prompt: buildUserPrompt(input.question, input.sources),
      // Low temperature: this is a retrieval task, not creative writing.
      temperature: 0.1,
      /**
       * Gemini 3.x reasons before answering and those thinking tokens count
       * against maxOutputTokens. With a small budget the visible answer was
       * truncated mid-sentence. The budget is raised, and thinking is limited
       * because the work is constrained extraction over supplied records rather
       * than open reasoning: a small budget also reduces latency and cost.
       */
      maxOutputTokens: 2000,
      providerOptions: {
        google: {
          thinkingConfig: { thinkingBudget: 512 },
        },
      },
      abortSignal: AbortSignal.timeout(45_000),
    });

    const text = (result.text ?? '').trim();

    if (text.length === 0) {
      return {
        answer: deterministicSummary(input.sources),
        grounded: true,
        modelUsed: false,
        modelId: env.modelId,
        sourceEventIds,
        failureReason: 'The assistant returned an empty answer. Showing your saved records instead.',
      };
    }

    return {
      answer: text,
      grounded: true,
      modelUsed: true,
      modelId: env.modelId,
      sourceEventIds,
      failureReason: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[vendra] answer generation failed', message.slice(0, 200));

    return {
      answer: deterministicSummary(input.sources),
      grounded: true,
      modelUsed: false,
      modelId: env.modelId,
      sourceEventIds,
      failureReason:
        'The assistant could not be reached. Here is what your saved records show.',
    };
  }
}

/**
 * A readable, factual summary built only from the records.
 *
 * Used when the model is unavailable or empty. This keeps the product useful
 * without ever presenting an unverified claim.
 */
export function deterministicSummary(sources: RecallSource[]): string {
  const newest = [...sources].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];

  if (!newest) return NO_RECORD_ANSWER;

  const lineParts: string[] = [];
  for (const line of newest.lines.slice(0, 6)) {
    const qty = line.agreedQuantity ?? line.quotedQuantity;
    const price = line.agreedUnitPrice ?? line.quotedUnitPrice;
    const segments: string[] = [line.productLabel];
    if (qty !== null) segments.push(`${qty}${line.unitLabel ? ` ${line.unitLabel}` : ''}`);
    if (price !== null) segments.push(`at ${price} ${newest.currencyCode}`);
    if (line.receivedQuantity !== null) segments.push(`received ${line.receivedQuantity}`);
    lineParts.push(segments.join(' '));
  }

  const distinctDealCount = new Set(sources.map((s) => s.dealId)).size;

  return [
    `Your most recent matching record is with ${newest.supplierName}, dated ${newest.occurredAt.slice(0, 10)}.`,
    newest.summary,
    lineParts.length ? `Items on that deal: ${lineParts.join('; ')}.` : null,
    newest.evidence.length
      ? `Evidence attached: ${newest.evidence.map((e) => e.originalFilename).join(', ')}.`
      : 'No evidence is attached to this deal yet.',
    sources.length > 1
      ? `${sources.length} matching records were found across ${distinctDealCount} deal${
          distinctDealCount === 1 ? '' : 's'
        }. Open the sources below to check them.`
      : null,
  ]
    .filter(Boolean)
    .join('\n\n');
}

// ---------------------------------------------------------------------------
// Follow-up draft
// ---------------------------------------------------------------------------

const DRAFT_SYSTEM_PROMPT = `You draft a short message a retailer can send to a supplier about a specific recorded deal.

You will be given the retailer's selected records and their goal.

Rules:
1. Use ONLY the recorded facts. Never invent a quantity, price, date or outcome.
2. Do not threaten, accuse or blame. Keep a factual, professional tone.
3. Ask for a specific, answerable next step.
4. Plain British English. Maximum 120 words. No subject line. No sign-off signature.
5. Never mention Vendra, Walrus, Sui, AI or this system.
6. Output only the message text. No preamble, no quotes around it.`;

export interface DraftResult {
  draft: string;
  modelUsed: boolean;
  sourceEventIds: string[];
  failureReason: string | null;
}

export async function draftFollowUp(input: {
  goal: string;
  sources: RecallSource[];
}): Promise<DraftResult> {
  const sourceEventIds = input.sources.map((s) => s.eventId);

  if (input.sources.length === 0) {
    return {
      draft: '',
      modelUsed: false,
      sourceEventIds: [],
      failureReason: 'Select at least one saved record before drafting a follow-up.',
    };
  }

  const env = modelEnv();
  const context = renderSourceContext(input.sources);

  if (!env) {
    return {
      draft: templateDraft(input.goal, input.sources),
      modelUsed: false,
      sourceEventIds,
      failureReason:
        'The assistant model is not configured in this environment, so this is a template built from your records. Edit it before sending.',
    };
  }

  try {
    const result = await generateText({
      model: google(env.modelId),
      system: DRAFT_SYSTEM_PROMPT,
      prompt: `SELECTED RECORDS\n${context}\n\nGOAL\n${input.goal}\n\nWrite the message.`,
      temperature: 0.3,
      // Same reasoning as the answer path: Gemini 3.x thinking tokens share the
      // output budget, so a larger budget is needed to avoid a truncated draft.
      maxOutputTokens: 2000,
      providerOptions: {
        google: {
          thinkingConfig: { thinkingBudget: 512 },
        },
      },
      abortSignal: AbortSignal.timeout(45_000),
    });

    const text = (result.text ?? '').trim();

    if (text.length === 0) {
      return {
        draft: templateDraft(input.goal, input.sources),
        modelUsed: false,
        sourceEventIds,
        failureReason: 'The assistant returned an empty draft. This template uses your records instead.',
      };
    }

    return { draft: text, modelUsed: true, sourceEventIds, failureReason: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[vendra] draft generation failed', message.slice(0, 200));
    return {
      draft: templateDraft(input.goal, input.sources),
      modelUsed: false,
      sourceEventIds,
      failureReason: 'The assistant could not be reached. This template uses your records — edit it before sending.',
    };
  }
}

function templateDraft(goal: string, sources: RecallSource[]): string {
  const newest = [...sources].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
  if (!newest) return '';

  return [
    `Good day. I am writing about our ${newest.dealDate} order recorded in my shop records.`,
    '',
    newest.summary,
    '',
    `The items recorded on that order are: ${newest.lines
      .map((l) => l.productLabel)
      .join(', ') || 'as recorded on the order slip'}.`,
    '',
    goal.trim() || 'Could you confirm the current status and let me know the next step?',
    '',
    'Thank you.',
  ].join('\n');
}