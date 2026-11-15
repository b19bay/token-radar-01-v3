// Launch Radar — entrypoint.
//
// Reads the sealed snapshot, builds the ranked board (lib/model.ts), and
// writes board.json, data.js, dashboard/, screenshots/ and dossier.json to
// the output directory. Deterministic: two runs write identical bytes.
// The output directory itself is never removed — only its contents are
// emptied — because the grader mounts it.
// SPDX-License-Identifier: MIT

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-board.ts';
import { buildBoard } from './lib/model.ts';
import type { Protocol, Snapshot } from './lib/model.ts';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DOSSIER_MAX = 1572864; // 1.5 MiB, the gate's dossier cap
const SHOT_MAX_BYTES = 524288; // 512 KiB per screenshot
const SHOT_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

function fail(message: string): never {
  console.error(`launch-radar: ${message}`);
  process.exit(1);
}

function parseArgs(argv: string[]): { input: string; output: string } {
  let input = '/input';
  let output = process.env['MAKEFUN_OUTPUT_DIR'] ?? '/output';
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--input' && i + 1 < argv.length) input = argv[++i]!;
    else if (arg === '--output' && i + 1 < argv.length) output = argv[++i]!;
    else if (arg.startsWith('--input=')) input = arg.slice('--input='.length);
    else if (arg.startsWith('--output=')) output = arg.slice('--output='.length);
    else if (arg === '--help' || arg === '-h') {
      console.log('usage: node main.ts [--input <snapshot.json|dir>] [--output <dir>]');
      process.exit(0);
    } else {
      fail(`unknown argument: ${arg}`);
    }
  }
  return { input, output };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function validateSnapshot(raw: unknown): Snapshot {
  if (!isRecord(raw)) fail('snapshot is not a JSON object');
  if (typeof raw['as_of'] !== 'string') fail('snapshot as_of is not a string');
  if (typeof raw['floor_usd'] !== 'number' || !Number.isFinite(raw['floor_usd'])) fail('snapshot floor_usd is not a finite number');
  if (!Array.isArray(raw['protocols'])) fail('snapshot protocols is not an array');
  if (!Array.isArray(raw['watchlist']) || raw['watchlist'].length === 0) fail('snapshot watchlist is empty');
  for (const w of raw['watchlist']) {
    if (typeof w !== 'string') fail('snapshot watchlist holds a non-string');
  }
  for (const p of raw['protocols']) {
    if (!isRecord(p)) fail('snapshot protocols holds a non-object');
    const bad =
      typeof p['slug'] !== 'string' ||
      typeof p['name'] !== 'string' ||
      (p['category'] !== null && typeof p['category'] !== 'string') ||
      !Array.isArray(p['chains']) ||
      p['chains'].some((c) => typeof c !== 'string') ||
      typeof p['tvl_usd'] !== 'number' ||
      !Number.isFinite(p['tvl_usd']) ||
      (p['change_7d'] !== null && typeof p['change_7d'] !== 'number') ||
      (p['mcap_usd'] !== null && typeof p['mcap_usd'] !== 'number') ||
      (p['listed_at'] !== null && typeof p['listed_at'] !== 'string') ||
      (p['gecko_id'] !== null && typeof p['gecko_id'] !== 'string') ||
      (p['symbol'] !== null && typeof p['symbol'] !== 'string');
    if (bad) fail(`snapshot protocol ${String(p['slug'] ?? '?')} has a bad field`);
  }
  return raw as unknown as Snapshot;
}

/** Empty a directory's contents. The directory itself is never removed. */
function emptyDirContents(dir: string): void {
  mkdirSync(dir, { recursive: true });
  for (const entry of readdirSync(dir)) {
    rmSync(join(dir, entry), { recursive: true, force: true });
  }
}

/** Copy a tree of regular files, skipping dotfiles and dot-directories. */
function copyTree(src: string, dst: string): number {
  mkdirSync(dst, { recursive: true });
  let count = 0;
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const from = join(src, entry.name);
    const to = join(dst, entry.name);
    if (entry.isDirectory()) {
      count += copyTree(from, to);
    } else if (entry.isFile()) {
      copyFileSync(from, to);
      count++;
    }
  }
  return count;
}

function selfCheck(build: ReturnType<typeof buildBoard>, snapshot: Snapshot): void {
  const { rows, meta, debug } = build;
  const slugs = new Set(rows.map((r) => r.slug));
  for (const w of snapshot.watchlist) {
    if (!slugs.has(w)) fail(`self-check: watchlist slug ${w} is not on the board`);
  }
  if (rows.length < 100) fail(`self-check: only ${rows.length} board rows, need at least 100`);
  let prev = Number.POSITIVE_INFINITY;
  let allEqual = true;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    if (r.rank !== i + 1) fail(`self-check: row ${i} has rank ${r.rank}, expected ${i + 1}`);
    if (r.implied_value_usd > prev) fail(`self-check: implied value rises at rank ${r.rank}`);
    if (i > 0 && r.implied_value_usd !== rows[0]!.implied_value_usd) allEqual = false;
    prev = r.implied_value_usd;
    if (!Number.isInteger(r.implied_value_usd) || r.implied_value_usd <= 0) fail(`self-check: rank ${r.rank} has a bad implied value`);
    if (r.farm_steps.length !== 8) fail(`self-check: rank ${r.rank} has ${r.farm_steps.length} farm steps, expected 8`);
    for (const step of r.farm_steps) {
      const len = step.trim().length;
      if (len < 20 || len > 600) fail(`self-check: rank ${r.rank} has a farm step of ${len} chars (need 20-600)`);
    }
  }
  if (allEqual) fail('self-check: all implied values are equal, not a ranking');
  for (const fam of Object.keys(debug.families)) {
    const e = debug.families[fam]!.effect;
    if (!Number.isFinite(e) || e <= 0) fail(`self-check: family ${fam} has a bad effect ${e}`);
  }
  const bt = meta.backtest;
  const nums = [
    bt.loo.median_miss, bt.loo.within3, bt.loo.within2,
    bt.loo_flat.median_miss, bt.loo_flat.within3, bt.loo_flat.within2,
    bt.time_split.median_miss, bt.time_split.within3,
    bt.time_split_flat.median_miss, bt.time_split_flat.within3,
    bt.band.p10, bt.band.p90, bt.band.coverage,
    bt.factor_check.r_growth, bt.factor_check.r_age,
  ];
  for (const n of nums) {
    if (!Number.isFinite(n)) fail('self-check: a backtest number is not finite');
  }
  const base = meta.sensitivity.scenarios[0]!;
  if (base.name !== 'base') fail('self-check: first sensitivity scenario is not base');
  if (base.median_implied_usd !== meta.totals.median_implied_usd) fail('self-check: base sensitivity median does not reproduce the board');
  if (base.top1_implied_usd !== rows[0]!.implied_value_usd) fail('self-check: base sensitivity top-1 does not reproduce the board');
  if (
    base.verdicts.farm !== meta.totals.verdicts.farm ||
    base.verdicts.thin !== meta.totals.verdicts.thin ||
    base.verdicts.skip !== meta.totals.verdicts.skip
  ) {
    fail('self-check: base sensitivity verdicts do not reproduce the board');
  }
  if (base.verdict_changes !== 0) fail('self-check: base sensitivity reports verdict changes against itself');
}

function main(): void {
  const { input, output } = parseArgs(process.argv.slice(2));

  let inputPath = input;
  if (statSync(inputPath, { throwIfNoEntry: false })?.isDirectory()) {
    inputPath = join(inputPath, 'snapshot.json');
  }
  let rawText: string;
  try {
    rawText = readFileSync(inputPath, 'utf8');
  } catch {
    fail(`cannot read snapshot at ${inputPath}`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(rawText!);
  } catch {
    fail('snapshot is not valid JSON');
  }
  const snapshot = validateSnapshot(raw);

  const build = buildBoard(snapshot);
  selfCheck(build, snapshot);

  // Validate the screenshots in the repo before writing anything.
  const shotsDir = join(ROOT, 'screenshots');
  if (!existsSync(shotsDir)) fail('repo has no screenshots/ directory');
  const shots = readdirSync(shotsDir, { withFileTypes: true })
    .filter((e) => e.isFile() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort();
  if (shots.length !== 4) fail(`screenshots/ holds ${shots.length} images, expected exactly 4`);
  for (const name of shots) {
    if (!SHOT_NAME.test(name)) fail(`screenshot name ${name} is not a dossier image name`);
    if (!/\.(png|jpe?g)$/i.test(name)) fail(`screenshot ${name} is not a PNG or JPEG`);
    const size = statSync(join(shotsDir, name)).size;
    if (size > SHOT_MAX_BYTES) fail(`screenshot ${name} is ${size} bytes, over the 512 KiB cap`);
  }
  const dashDir = join(ROOT, 'dashboard');
  if (!existsSync(join(dashDir, 'index.html'))) fail('repo dashboard/ has no index.html');

  // Empty the output directory's contents (never the directory itself),
  // then write the outputs. Dossier goes last.
  emptyDirContents(output);
  const boardJson = `${JSON.stringify({ rows: build.rows }, null, 2)}\n`;
  writeFileSync(join(output, 'board.json'), boardJson, 'utf8');
  const dataJs = `window.RADAR = ${JSON.stringify({ meta: build.meta, rows: build.rows, live_rows: build.live_rows, aside_rows: build.aside_rows, aside_counts: build.aside_counts, comps: build.comps })};\n`;
  writeFileSync(join(output, 'data.js'), dataJs, 'utf8');
  const dashFiles = copyTree(dashDir, join(output, 'dashboard'));
  copyTree(shotsDir, join(output, 'screenshots'));
  const dossier = buildDossier(output, {
    text_max_bytes: 65536,
    screenshots: { max: 4, max_bytes: SHOT_MAX_BYTES },
    dashboard: { max_files: 400, max_bytes: 4 * 1024 * 1024 },
  });
  if (dossier.length > DOSSIER_MAX) {
    fail(`dossier.json is ${dossier.length} bytes, over the 1.5 MiB gate cap — shrink the screenshots`);
  }
  writeFileSync(join(output, 'dossier.json'), dossier);

  const { meta, debug } = build;
  const fmtM = (n: number): string => `$${(n / 1e6).toFixed(1)}M`;
  console.log(`launch-radar: ${meta.totals.protocols_scanned} protocols scanned, ${meta.totals.ranked} ranked, ${meta.totals.live} live, ${meta.totals.set_aside} set aside`);
  console.log(`curve: a=${debug.curve.a.toFixed(4)} b=${debug.curve.b.toFixed(4)} R2=${debug.curve.r2.toFixed(3)} n=${debug.curve.n}`);
  console.log(`families: ${Object.keys(debug.families).map((f) => `${f} x${debug.families[f]!.effect.toFixed(3)} (n=${debug.families[f]!.n})`).join(', ')}`);
  console.log(`seasoning: fitted=${debug.coef_fitted.toFixed(4)} used=${debug.coef_used.toFixed(4)}; band q10=${debug.q10.toFixed(2)} q90=${debug.q90.toFixed(2)}`);
  console.log(`backtest: LOO x${meta.backtest.loo.median_miss} (${meta.backtest.loo.within3}% in 3x) vs flat x${meta.backtest.loo_flat.median_miss}; time-split x${meta.backtest.time_split.median_miss} (${meta.backtest.time_split.within3}% in 3x) vs flat x${meta.backtest.time_split_flat.median_miss}; band ${meta.backtest.band.coverage}%`);
  console.log(`verdicts: FARM ${meta.totals.verdicts.farm} / THIN ${meta.totals.verdicts.thin} / SKIP ${meta.totals.verdicts.skip}; total implied ${fmtM(meta.totals.total_implied_usd)}, median ${fmtM(meta.totals.median_implied_usd)}`);
  console.log(`top 10: ${build.rows.slice(0, 10).map((r) => `#${r.rank} ${r.name} ${fmtM(r.implied_value_usd)} ${r.econ.verdict}`).join(' | ')}`);
  console.log(`sensitivity: ${meta.sensitivity.scenarios.map((s) => `${s.name} med ${fmtM(s.median_implied_usd)} top1 ${fmtM(s.top1_implied_usd)} F${s.verdicts.farm}/T${s.verdicts.thin}/S${s.verdicts.skip} chg ${s.verdict_changes}`).join(' | ')}`);
  console.log(`wrote ${output}/board.json, data.js, dashboard/ (${dashFiles} files), screenshots/ (4), dossier.json (${dossier.length} bytes)`);
}

main();
