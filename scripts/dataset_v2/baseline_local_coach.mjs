// Baseline: run every eval question through the CURRENT offline coach engine
// (lib/data/climate-knowledge.ts -> generateScientificCoachAdvice), which the Coach page
// shows whenever the backend is unavailable and whose citations it attaches to Gemini replies.
//
//   node scripts/dataset_v2/baseline_local_coach.mjs <typescript-module-dir> <eval.jsonl> <out.jsonl>
//
// Inputs mirror what app/app/coach/page.tsx passes for the U_A fixture: today's total, the
// biggest category, the streak, and the store's seeded totalSaved (savedBaseline = 42).
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [tsDir, evalPath, outPath] = process.argv.slice(2);
const require = createRequire(import.meta.url);
const ts = require(path.join(tsDir, 'lib', 'typescript.js'));
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = readFileSync(path.join(repo, 'lib', 'data', 'climate-knowledge.ts'), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', js)(mod, mod.exports);
const { generateScientificCoachAdvice } = mod.exports;

// U_A day-0 values (computed by build_eval fixtures: 12 km car + 6 kWh)
const ctx = { userName: 'Aarav', todayTotal: 5.82, biggestCategory: 'Electricity', biggestValue: 4.26, streak: 7, totalSaved: 42 };

const out = [];
for (const line of readFileSync(evalPath, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  const c = JSON.parse(line);
  const t0 = performance.now();
  const r = generateScientificCoachAdvice({ query: c.question, ...ctx });
  out.push({
    case_id: c.case_id,
    answer: r.response,
    tool_calls: [],                       // the local engine calls no tools
    citations: [],                        // it emits free-text citations, none resolvable to a source_id
    citation_text: `${r.source} | ${r.citation}`,
    latency_ms: Math.round((performance.now() - t0) * 1000) / 1000,
    model: 'local-keyword-engine',
  });
}
writeFileSync(outPath, out.map((o) => JSON.stringify(o)).join('\n') + '\n');
console.log(`ran ${out.length} cases -> ${outPath}`);
