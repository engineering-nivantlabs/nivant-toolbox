import { Claude, S, type Attachment } from '../connectors/claude.js';
import { readProjectFile } from '../project.js';
import { StepError, type Handler, type StepContext } from '../engine/types.js';

const asText = (v: unknown) => (v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v, null, 2));

async function attachments(sc: StepContext, files: { id: string }[] = []): Promise<Attachment[]> {
  return Promise.all(files.map(async f => {
    const { ref, data } = await sc.services.connectors.files.get(f.id);
    return { name: ref.name, mime: ref.mime, data };
  }));
}

const ai = (sc: StepContext) => sc.services.connectors.ai;

type FieldSpec = string[] | Record<string, string | { type: string; description?: string; enum?: string[]; items?: unknown }>;

function fieldSchema(fields: FieldSpec) {
  const props: Record<string, object> = {};
  const entries = Array.isArray(fields) ? fields.map(f => [f, {}] as const) : Object.entries(fields);
  for (const [name, spec] of entries) {
    const s = typeof spec === 'string' ? { type: 'string', description: spec } : { type: 'string', ...spec } as { type: string; description?: string; enum?: string[]; items?: unknown };
    const base: Record<string, unknown> = { type: [s.type, 'null'] };
    if (s.description) base.description = s.description;
    if (s.enum) { base.enum = [...s.enum, null]; }
    if (s.type === 'array') base.items = s.items ?? { type: 'string' };
    if (s.type === 'object') Object.assign(base, { properties: {}, additionalProperties: true });
    props[name] = base;
  }
  return S.obj(props);
}

export const extract: Handler = async (p, sc) => {
  const out = await ai(sc).json<Record<string, unknown>>({
    task: 'Extract the requested fields from the input (text and any attachments). Use null for anything not stated or clearly implied. ' +
      'Normalise values: numbers without currency symbols unless asked, dates as ISO 8601.' + (p.instructions ? `\n${p.instructions}` : ''),
    input: Claude.content(`Input:\n${asText(p.input)}`, await attachments(sc, p.files)),
    schema: fieldSchema(p.fields), effort: 'low',
  });
  const missing = Object.entries(out).filter(([, v]) => v == null).map(([k]) => k);
  return { ...out, _missing: missing };
};

export const classify: Handler = async (p, sc) => {
  const labels: string[] = Array.isArray(p.labels) ? p.labels : Object.keys(p.labels);
  const described = Array.isArray(p.labels) ? labels.map(l => `- ${l}`) : Object.entries(p.labels as Record<string, string>).map(([l, d]) => `- ${l}: ${d}`);
  const out = await ai(sc).json<{ label: string; confidence: number; reason: string; language: string | null }>({
    task: `Classify the input into exactly one of these labels:\n${described.join('\n')}` +
      (p.detect_language ? '\nAlso give the input language as an ISO 639-1 code.' : '') + (p.instructions ? `\n${p.instructions}` : ''),
    input: Claude.content(`Input:\n${asText(p.input)}`),
    schema: S.obj({ label: S.enum(labels), confidence: S.num('0 to 1'), reason: S.str('one short sentence'), language: S.nstr('ISO 639-1 code, or null if not asked') }),
    effort: 'low',
  });
  return { ...out, confidence: Math.max(0, Math.min(1, out.confidence)) };
};

export const summarize: Handler = async (p, sc) => {
  const flagTypes: string[] = p.flags;
  return ai(sc).json({
    task: `Summarise the input in the "${p.style}" style, at most ${p.max_words} words. Lead with what matters for the business.` +
      (flagTypes.length ? `\nAlso list anything that falls under: ${flagTypes.join(', ')}.` : ''),
    input: Claude.content(`Input:\n${asText(p.input)}`, await attachments(sc, p.files)),
    schema: S.obj({ summary: S.str(), flags: S.arr(S.obj({ type: flagTypes.length ? S.enum(flagTypes) : S.str(), detail: S.str() })) }),
    effort: 'medium',
  });
};

export const generate: Handler = async (p, sc) => {
  const schema = p.format === 'email' ? S.obj({ subject: S.str(), text: S.str('plain-text body') }) : S.obj({ text: S.str() });
  return ai(sc).json({
    task: `Write a ${p.format === 'email' ? 'customer email' : 'message'} of at most ${p.max_words} words.\nBrief: ${p.brief}` +
      (p.tone ? `\nTone: ${p.tone}` : '') + (p.language ? `\nWrite it in ${p.language}.` : '') +
      '\nUse only facts from the context; never invent prices, dates, availability or promises. No placeholders like [Name].',
    input: Claude.content(`Context:\n${asText(p.context ?? {})}`),
    schema, effort: 'medium',
  });
};

export const qualify: Handler = async (p, sc) => {
  const rubric = readProjectFile(sc.services.project, 'rubrics', p.rubric);
  const out = await ai(sc).json<{ score: number; label: string; reasons: string[] }>({
    task: `Score the input against this rubric. score is 0 to 1; label is hot (score ≥ 0.7), warm (0.4 to 0.7) or cold (< 0.4).\n\nRubric:\n${rubric}`,
    input: Claude.content(`Input:\n${asText(p.input)}`),
    schema: S.obj({ score: S.num(), label: S.enum(['hot', 'warm', 'cold']), reasons: S.arr(S.str()) }),
    effort: 'high',
  });
  const score = Math.max(0, Math.min(1, out.score));
  return { ...out, score };
};

export const translate: Handler = async (p, sc) => {
  const out = await ai(sc).json<{ text: string; from: string }>({
    task: `Translate the text into ${p.to}. Keep meaning, tone, names, numbers, links and emoji. If it is already in ${p.to}, return it unchanged.`,
    input: Claude.content(p.text),
    schema: S.obj({ text: S.str(), from: S.str('ISO 639-1 code of the source language') }),
    effort: 'low',
  });
  return { ...out, to: p.to };
};

export const sentiment: Handler = async (p, sc) => {
  const scale = p.rating_scale as number | undefined;
  return ai(sc).json({
    task: 'Read the customer message and report its sentiment, tone and urgency.' +
      (scale ? ` If it contains a rating on a 1 to ${scale} scale (digits, words or stars), return it as an integer; otherwise null.` : ' rating is always null.'),
    input: Claude.content(`Message:\n${asText(p.input)}`),
    schema: S.obj({ sentiment: S.enum(['positive', 'neutral', 'negative']), tone: S.str('a few words, e.g. "frustrated but polite"'), urgency: S.enum(['low', 'medium', 'high']), rating: S.nint() }),
    effort: 'low',
  });
};

export const decide: Handler = async (p, sc) => {
  const options: unknown[] = p.options;
  const out = await ai(sc).json<{ choices: { index: number; score: number; reason: string }[] }>({
    task: `Pick the best ${p.choose} option(s) for the input, judged on: ${p.criteria.join(', ')}. ` +
      'Return them best first, by their index, with a 0 to 1 fit score and a one-sentence reason.',
    input: Claude.content(`Input:\n${asText(p.input)}\n\nOptions:\n${options.map((o, i) => `[${i}] ${asText(o)}`).join('\n')}`),
    schema: S.obj({ choices: S.arr(S.obj({ index: { type: 'integer' }, score: S.num(), reason: S.str() })) }),
    effort: 'medium',
  });
  const choices = out.choices.filter(c => Number.isInteger(c.index) && c.index >= 0 && c.index < options.length).slice(0, p.choose)
    .map(c => ({ option: options[c.index], index: c.index, score: Math.max(0, Math.min(1, c.score)), reason: c.reason }));
  if (!choices.length) throw new StepError('Claude chose no valid option', true);
  return { choices, choice: choices[0].option };
};
