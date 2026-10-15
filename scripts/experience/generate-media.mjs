#!/usr/bin/env node
/**
 * Generate optional cinematic media for the experience, via the muapi.ai API
 * that Open-Higgsfield-AI uses (https://github.com/Autom8AI/Open-Higgsfield-AI,
 * src/lib/muapi.js): POST /api/v1/{model} with `x-api-key`, then poll
 * /api/v1/predictions/{id}/result.
 *
 *   node scripts/experience/generate-media.mjs             # dry run — prints what would be generated
 *   MUAPI_API_KEY=… node scripts/experience/generate-media.mjs --run
 *   MUAPI_API_KEY=… node scripts/experience/generate-media.mjs --run --only=interlude-canopy
 *   … --force                                              # regenerate slots that already exist
 *
 * This calls a PAID service. Nothing is sent without --run.
 * The key is read from the environment only — never pass it as an argument,
 * never commit it. Outputs land in public/experience/generated/ and are
 * recorded in lib/experience/generated-media.json with model, prompt and date,
 * so each asset is traceable and labelled AI-generated in the UI.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PROMPTS = join(ROOT, 'lib/experience/media-prompts.json');
const MANIFEST = join(ROOT, 'lib/experience/generated-media.json');
const OUT_DIR = join(ROOT, 'public/experience/generated');
const API = 'https://api.muapi.ai/api/v1';

const args = new Set(process.argv.slice(2));
const RUN = args.has('--run');
const FORCE = args.has('--force');
const ONLY = [...args].find((a) => a.startsWith('--only='))?.slice('--only='.length);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function submit(key, slot) {
  const body = { prompt: slot.prompt };
  if (slot.aspect_ratio) body.aspect_ratio = slot.aspect_ratio;
  if (slot.duration) body.duration = slot.duration;
  if (slot.kind === 'image') body.image_url = null;

  const res = await fetch(`${API}/${slot.model}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`submit ${slot.id}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function poll(key, requestId, { attempts = 150, intervalMs = 4000 } = {}) {
  for (let i = 1; i <= attempts; i++) {
    await sleep(intervalMs);
    const res = await fetch(`${API}/predictions/${requestId}/result`, { headers: { 'x-api-key': key } });
    if (!res.ok) {
      if (res.status >= 500) continue;
      throw new Error(`poll ${requestId}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    }
    const data = await res.json();
    const status = String(data.status ?? '').toLowerCase();
    if (['completed', 'succeeded', 'success'].includes(status)) return data;
    if (['failed', 'error'].includes(status)) throw new Error(`generation failed: ${data.error ?? 'unknown error'}`);
    process.stdout.write('.');
  }
  throw new Error(`timed out waiting for ${requestId}`);
}

function outputUrl(result) {
  return result.outputs?.[0] ?? result.url ?? result.output?.url ?? null;
}

async function download(url, slot) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${slot.id}: HTTP ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  const ext =
    extname(new URL(url).pathname) ||
    (type.includes('png') ? '.png' : type.includes('webp') ? '.webp' : type.includes('mp4') ? '.mp4' : slot.kind === 'video' ? '.mp4' : '.jpg');
  const file = `${slot.id}${ext}`;
  await writeFile(join(OUT_DIR, file), Buffer.from(await res.arrayBuffer()));
  return `/experience/generated/${file}`;
}

async function main() {
  const { slots } = JSON.parse(await readFile(PROMPTS, 'utf8'));
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
  const todo = slots.filter((s) => (!ONLY || s.id === ONLY) && (FORCE || !manifest.slots[s.id]));

  if (ONLY && !slots.some((s) => s.id === ONLY)) throw new Error(`no slot "${ONLY}" in media-prompts.json`);
  if (todo.length === 0) {
    console.log('Nothing to generate (all slots filled — use --force to regenerate).');
    return;
  }

  console.log(`${RUN ? 'Generating' : 'DRY RUN — would generate'} ${todo.length} asset(s):`);
  for (const s of todo) console.log(`  • ${s.id}  [${s.kind}, ${s.model}${s.duration ? `, ${s.duration}s` : ''}]\n      ${s.prompt}`);
  if (!RUN) {
    console.log('\nNothing was sent. Re-run with --run (and MUAPI_API_KEY set) to call the paid API.');
    return;
  }

  const key = process.env.MUAPI_API_KEY;
  if (!key) throw new Error('MUAPI_API_KEY is not set. Export it in your shell; do not put it in a file in the repo.');

  await mkdir(OUT_DIR, { recursive: true });
  for (const slot of todo) {
    console.log(`\n→ ${slot.id}`);
    const submitted = await submit(key, slot);
    const requestId = submitted.request_id ?? submitted.id;
    const result = requestId ? await poll(key, requestId) : submitted;
    const url = outputUrl(result);
    if (!url) throw new Error(`no output URL for ${slot.id}: ${JSON.stringify(result).slice(0, 200)}`);
    const src = await download(url, slot);
    manifest.slots[slot.id] = {
      src,
      kind: slot.kind,
      alt: slot.alt,
      model: slot.model,
      prompt: slot.prompt,
      generatedAt: new Date().toISOString(),
    };
    await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`\n  saved ${src}`);
  }
  console.log('\nDone. Review every asset before committing it.');
}

main().catch((err) => {
  console.error(`\n✖ ${err.message}`);
  process.exit(1);
});
