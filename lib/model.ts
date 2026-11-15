// Launch Radar — model library (radar-3-curve).
//
// A fitted log-log size curve over the tokens that already trade, shrunk
// family effects, a shrunk seasoning term and a sibling haircut price every
// protocol that records no token. Every constant is computed from the
// snapshot at run time; nothing about any protocol is hardcoded.
// SPDX-License-Identifier: MIT

export interface Protocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: Protocol[];
  watchlist: string[];
}

export interface Comp {
  slug: string;
  name: string;
  category: string | null;
  family: string;
  tvl_usd: number;
  mcap_usd: number;
  listed_at: string | null;
  change_7d: number | null;
  age_days: number | null;
}

export interface CurveFit {
  a: number;
  b: number;
  r2: number;
  n: number;
}

export interface FamilyFit {
  effect: number;
  n: number;
}

export interface Backtest {
  loo: { median_miss: number; within3: number; within2: number };
  loo_curve: { median_miss: number; within3: number; within2: number };
  loo_flat: { median_miss: number; within3: number; within2: number };
  time_split: { median_miss: number; within3: number; n_train: number; n_test: number };
  time_split_flat: { median_miss: number; within3: number };
  band: { p10: number; p90: number; coverage: number };
  factor_check: { r_growth: number; r_age: number };
}

export interface SensitivityScenario {
  name: string;
  median_implied_usd: number;
  top1_implied_usd: number;
  verdicts: { farm: number; thin: number; skip: number };
  verdict_changes: number;
}

export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  family: string;
  mechanism: string;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  p10_usd: number;
  p90_usd: number;
  p25_usd: number;
  p75_usd: number;
  token_status: string;
  watchlist: boolean;
  sibling: boolean;
  early: boolean;
  model: {
    curve_value_usd: number;
    family_effect: number;
    family_peer_count: number;
    growth_pct: number;
    projected_tvl_usd: number;
    seasoning: number;
    sibling_factor: number;
  };
  econ: {
    slice_usd: number;
    fees_usd: number;
    tbill_usd: number;
    net_usd: number;
    verdict: string;
    work_minutes: number;
    per_hour_usd: number;
    pays_from_usd: number | null;
    plan_chain: string;
    gas_usd: number;
  };
  farm_steps: string[];
}

export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  ratio: number | null;
}

export interface AsideRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  reason: string;
}

export interface CompOut {
  tvl_usd: number;
  mcap_usd: number;
  name: string;
  family: string;
  loo: number;
}

export interface RadarMeta {
  as_of: string;
  floor_usd: number;
  model_version: string;
  curve: { a: number; b: number; r2: number; n_comps: number };
  families: Record<string, { effect: number; n: number }>;
  seasoning: { coef_fitted: number; coef_used: number };
  backtest: Backtest;
  sensitivity: { scenarios: SensitivityScenario[] };
  economics: { capital_usd: number; hold_days: number; tbill_rate: number; airdrop_share: number; work_minutes: number };
  totals: {
    protocols_scanned: number;
    ranked: number;
    watchlist: number;
    set_aside: number;
    live: number;
    total_implied_usd: number;
    median_implied_usd: number;
    verdicts: { farm: number; thin: number; skip: number };
  };
}

export interface RadarBuild {
  rows: BoardRow[];
  live_rows: LiveRow[];
  aside_rows: AsideRow[];
  aside_counts: Record<string, number>;
  comps: CompOut[];
  meta: RadarMeta;
  // Unrounded internals for the self-checks in main.ts.
  debug: {
    curve: CurveFit;
    families: Record<string, FamilyFit>;
    coef_fitted: number;
    coef_used: number;
    q10: number;
    q25: number;
    q75: number;
    q90: number;
    n_pre_token: number;
    n_set_aside: number;
  };
}

// ---------------------------------------------------------------- tables

export const MODEL_VERSION = 'radar-3-curve';

// Category -> family. Any category not listed here falls in Other.
const FAMILY_CATS: Record<string, string[]> = {
  Vaults: ['Risk Curators', 'Onchain Capital Allocator', 'Yield Aggregator', 'Liquidity Manager', 'Collateral Management', 'CDP Manager'],
  Lending: ['Lending', 'CDP', 'Uncollateralized Lending', 'Leveraged Farming', 'Collateral Markets', 'Anchor BTC', 'Decentralized BTC'],
  Trading: ['Dexs', 'Derivatives', 'Basis Trading', 'Options', 'Options Vault', 'Prediction Market', 'OTC Marketplace', 'Privacy', 'NFT Marketplace', 'Interest Rate Derivatives'],
  RWA: ['RWA', 'Indexes'],
  Staking: ['Liquid Staking', 'Liquid Restaking', 'Restaking', 'Staking Pool', 'Restaked BTC', 'Token Locker'],
  Infra: ['Chain', 'AI Agents', 'Decentralized AI', 'Bridge', 'Canonical Bridge', 'Cross Chain Bridge'],
  Stable: ['Dual-Token Stablecoin', 'Stablecoin Wrapper', 'Payments', 'Crypto Card Issuer'],
  Yield: ['Yield'],
  CEX: ['CEX'],
};
export const FAMILY_ORDER = ['Vaults', 'Lending', 'Trading', 'RWA', 'Staking', 'Infra', 'Stable', 'Yield', 'CEX', 'Other'];

const FAMILY_OF = new Map<string, string>();
for (const fam of Object.keys(FAMILY_CATS)) {
  for (const cat of FAMILY_CATS[fam]!) FAMILY_OF.set(cat, fam);
}

export function familyOf(category: string | null): string {
  return category !== null && FAMILY_OF.has(category) ? FAMILY_OF.get(category)! : 'Other';
}

// Category -> farming mechanism. Any category not listed here is plain protocol use.
const MECHANISM_CATS: Record<string, string[]> = {
  'Vault curation': ['Risk Curators', 'Onchain Capital Allocator', 'Yield Aggregator', 'Liquidity Manager', 'Collateral Management', 'CDP Manager'],
  'Supply and borrow': ['Lending', 'Uncollateralized Lending'],
  'Collateralised debt': ['CDP', 'Collateral Markets'],
  'Liquidity pool': ['Dexs'],
  Derivatives: ['Derivatives', 'Interest Rate Derivatives'],
  'Basis vault': ['Basis Trading'],
  'Real-world yield': ['RWA'],
  Index: ['Indexes'],
  'Yield vault': ['Yield'],
  Staking: ['Staking Pool', 'Restaking'],
  'Chain activity': ['Chain'],
  Payments: ['Payments', 'Crypto Card Issuer'],
  'Private transaction': ['Privacy'],
  Cover: ['Insurance'],
  'Lock and vote': ['Governance Incentives'],
  'Launch allocation': ['Launchpad'],
  Farm: ['Farm'],
  'CeDeFi vault': ['CeDeFi'],
  'Mint and save': ['Dual-Token Stablecoin', 'Stablecoin Wrapper'],
  'OTC trade': ['OTC Marketplace'],
  'BTC yield': ['Anchor BTC', 'Decentralized BTC'],
  Prediction: ['Prediction Market'],
  'Options vault': ['Options', 'Options Vault'],
  'Leveraged farm': ['Leveraged Farming'],
};
const MECHANISM_OF = new Map<string, string>();
for (const mech of Object.keys(MECHANISM_CATS)) {
  for (const cat of MECHANISM_CATS[mech]!) MECHANISM_OF.set(cat, mech);
}

export function mechanismOf(category: string | null): string {
  return category !== null && MECHANISM_OF.has(category) ? MECHANISM_OF.get(category)! : 'Protocol use';
}

// Gas per transaction in USD, by chain. Unlisted chains cost the default.
export const GAS_USD: Record<string, number> = {
  Ethereum: 4.0, Solana: 0.01, Base: 0.05, Arbitrum: 0.1, Optimism: 0.1, Binance: 0.15,
  Polygon: 0.02, Avalanche: 0.3, Sui: 0.02, Monad: 0.01, 'Hyperliquid L1': 0.01, Berachain: 0.05,
  Sonic: 0.02, Sei: 0.01, Mantle: 0.05, Linea: 0.05, Scroll: 0.1, Blast: 0.05, Gnosis: 0.05,
  Fantom: 0.05, Tron: 0.5, Bitcoin: 2.0,
};
export const GAS_DEFAULT = 0.5;
export const BRIDGE_ALLOWANCE = 2.0;

const NATIVE_OF: Record<string, string> = {
  Ethereum: 'ETH', Solana: 'SOL', Base: 'ETH', Arbitrum: 'ETH', Optimism: 'ETH', Binance: 'BNB',
  Polygon: 'POL', Avalanche: 'AVAX', Sui: 'SUI', Monad: 'MON', 'Hyperliquid L1': 'HYPE',
  Berachain: 'BERA', Sonic: 'S', Sei: 'SEI', Mantle: 'MNT', Linea: 'ETH', Scroll: 'ETH',
  Blast: 'ETH', Gnosis: 'xDAI', Fantom: 'FTM', Tron: 'TRX', Bitcoin: 'BTC',
};

export function gasOf(chain: string): number {
  return GAS_USD[chain] ?? GAS_DEFAULT;
}

export function nativeOf(chain: string): string {
  return NATIVE_OF[chain] ?? 'its native token';
}

// Economics constants (the entry's own stated assumptions, not snapshot data).
export const CAPITAL_USD = 1000;
export const HOLD_DAYS = 90;
export const TBILL_RATE = 0.04;
export const AIRDROP_SHARE = 0.1;
export const WORK_MINUTES = 140;
export const PLAN_TXS = 7;

// ---------------------------------------------------------------- helpers

const VERSION_MARKER = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_START = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)(?![A-Za-z])/;
const FIRST_WORD_SPLIT = /[\s\-:()]+/;

export function firstWord(name: string): string {
  const parts = name.toLowerCase().split(FIRST_WORD_SPLIT).filter((w) => w.length > 0);
  return parts.length > 0 ? parts[0]! : '';
}

export function hasVersionMarker(name: string): boolean {
  return VERSION_MARKER.test(name);
}

export function recordsNoToken(p: Protocol): boolean {
  return p.gecko_id === null && p.symbol === null && p.mcap_usd === null;
}

export function ageDays(listedAt: string | null, asOfMs: number): number | null {
  if (listedAt === null) return null;
  const ms = Date.parse(`${listedAt}T00:00:00Z`);
  if (Number.isNaN(ms)) return null;
  const d = Math.floor((asOfMs - ms) / 86400000);
  return d < 0 ? 0 : d;
}

export function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function roundN(x: number, places: number): number {
  const f = 10 ** places;
  return Math.round(x * f) / f;
}

export function money(x: number): string {
  const sign = x < 0 ? '-' : '';
  const abs = Math.abs(x);
  const whole = Math.floor(abs).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const cents = Math.round((abs - Math.floor(abs)) * 100).toString().padStart(2, '0');
  return `${sign}${whole}.${cents}`;
}

/** Ordinary least squares of y on x, with intercept. */
export function ols(xs: number[], ys: number[]): { a: number; b: number; r2: number } {
  const n = xs.length;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += xs[i]!;
    my += ys[i]!;
  }
  mx /= n;
  my /= n;
  let sxx = 0;
  let sxy = 0;
  let sst = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    sxx += dx * dx;
    sxy += dx * dy;
    sst += dy * dy;
  }
  const b = sxx === 0 ? 0 : sxy / sxx;
  const a = my - b * mx;
  let sse = 0;
  for (let i = 0; i < n; i++) {
    const r = ys[i]! - (a + b * xs[i]!);
    sse += r * r;
  }
  return { a, b, r2: sst === 0 ? 0 : 1 - sse / sst };
}

/** Nearest-rank percentile of an ascending-sorted array; p in (0, 1). */
export function percentileRank(sortedAsc: number[], p: number): number {
  const n = sortedAsc.length;
  const idx = Math.max(0, Math.min(n - 1, Math.ceil(p * n) - 1));
  return sortedAsc[idx]!;
}

/** Median; for even n the upper-middle value. */
export function medianUpper(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return 0;
  return n % 2 === 1 ? s[(n - 1) / 2]! : s[n / 2]!;
}

export function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += xs[i]!;
    my += ys[i]!;
  }
  mx /= n;
  my /= n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  const d = Math.sqrt(sxx * syy);
  return d === 0 ? 0 : sxy / d;
}

// ---------------------------------------------------------------- comparables

const BRIDGE_CATS = new Set(['Bridge', 'Canonical Bridge']);
const STAKING_CATS = new Set(['Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);

function asideReason(p: Protocol, liveFirstWords: Set<string>, onWatchlist: boolean): string | null {
  const cat = p.category;
  if (cat !== null) {
    if (BRIDGE_CATS.has(cat)) return 'Wrapped / bridged product';
    if (STAKING_CATS.has(cat)) return 'Liquid staking product';
    if (cat === 'CEX') return 'Centralized exchange';
    if (/bridge/i.test(cat)) return 'Wrapped / bridged product';
  }
  if (WRAPPED_WORD.test(p.name)) return 'Wrapped / bridged product';
  if (hasVersionMarker(p.name)) return 'Versioned release';
  if (EXCHANGE_START.test(p.name)) return 'Centralized exchange';
  if (!onWatchlist && liveFirstWords.has(firstWord(p.name))) return 'Sibling of a traded token';
  return null;
}

/** The traded tokens the curve is fitted on: merged by token, bridge/version dropped, ratio trimmed. */
export function buildComparables(protocols: Protocol[], asOfMs: number): Comp[] {
  const groups = new Map<string, Protocol[]>();
  for (const p of protocols) {
    if (recordsNoToken(p)) continue;
    if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    const key = p.gecko_id ?? p.symbol ?? p.slug;
    const g = groups.get(key);
    if (g) g.push(p);
    else groups.set(key, [p]);
  }
  const comps: Comp[] = [];
  for (const members of groups.values()) {
    const rep = members[0]!;
    if (rep.category !== null && /bridge/i.test(rep.category)) continue;
    if (hasVersionMarker(rep.name)) continue;
    let tvl = 0;
    let mcap = 0;
    for (const m of members) {
      tvl += m.tvl_usd;
      if (m.mcap_usd !== null && m.mcap_usd > mcap) mcap = m.mcap_usd;
    }
    const ratio = mcap / tvl;
    if (ratio < 0.002 || ratio > 50) continue;
    comps.push({
      slug: rep.slug,
      name: rep.name,
      category: rep.category,
      family: familyOf(rep.category),
      tvl_usd: tvl,
      mcap_usd: mcap,
      listed_at: rep.listed_at,
      change_7d: rep.change_7d,
      age_days: ageDays(rep.listed_at, asOfMs),
    });
  }
  comps.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  return comps;
}

/** log10(mcap) = a + b * log10(TVL / $100M). */
export function fitCurve(comps: Comp[]): CurveFit {
  const xs = comps.map((c) => Math.log10(c.tvl_usd / 1e8));
  const ys = comps.map((c) => Math.log10(c.mcap_usd));
  const { a, b, r2 } = ols(xs, ys);
  return { a, b, r2, n: comps.length };
}

function curveValue(tvl: number, curve: CurveFit): number {
  return 10 ** (curve.a + curve.b * Math.log10(tvl / 1e8));
}

/** Shrunk family effects: effect = 10^((n/(n+4)) * mean curve-only log residual). */
export function fitFamilies(comps: Comp[], curve: CurveFit): Record<string, FamilyFit> {
  const sums = new Map<string, { sum: number; n: number }>();
  for (const c of comps) {
    const resid = Math.log10(c.mcap_usd) - Math.log10(curveValue(c.tvl_usd, curve));
    const e = sums.get(c.family);
    if (e) {
      e.sum += resid;
      e.n += 1;
    } else {
      sums.set(c.family, { sum: resid, n: 1 });
    }
  }
  const out: Record<string, FamilyFit> = {};
  for (const fam of FAMILY_ORDER) {
    const e = sums.get(fam);
    if (!e || e.n === 0) {
      out[fam] = { effect: 1, n: 0 };
    } else {
      const shrink = e.n / (e.n + 4);
      out[fam] = { effect: 10 ** (shrink * (e.sum / e.n)), n: e.n };
    }
  }
  return out;
}

/** Seasoning coefficient: regress curve+family residuals on log10(age_days), shrunk 50%. */
export function fitSeasoning(comps: Comp[], curve: CurveFit, fams: Record<string, FamilyFit>): { coef_fitted: number; coef_used: number; n: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const c of comps) {
    if (c.age_days === null || c.age_days < 1) continue;
    const pred = curveValue(c.tvl_usd, curve) * fams[c.family]!.effect;
    ys.push(Math.log10(c.mcap_usd) - Math.log10(pred));
    xs.push(Math.log10(c.age_days));
  }
  if (xs.length < 2) return { coef_fitted: 0, coef_used: 0, n: xs.length };
  const { b } = ols(xs, ys);
  return { coef_fitted: b, coef_used: b * 0.5, n: xs.length };
}

function seasoningFactor(ageDays: number | null, coefUsed: number): number {
  if (ageDays === null || ageDays < 1) return 1;
  const f = 10 ** (coefUsed * (Math.log10(ageDays) - Math.log10(365)));
  return Math.min(1.15, Math.max(0.8, f));
}

// ---------------------------------------------------------------- scoring

interface Scored {
  p: Protocol;
  family: string;
  mechanism: string;
  growth: number;
  projectedTvl: number;
  seasoning: number;
  siblingFactor: number;
  isSibling: boolean;
  onWatchlist: boolean;
  ageDays: number | null;
}

function prepareScored(p: Protocol, liveFirstWords: Set<string>, onWatchlist: boolean, coefUsed: number, asOfMs: number): Scored {
  const g = Math.min(30, Math.max(-30, p.change_7d ?? 0));
  const projectedTvl = p.tvl_usd * (1 + g / 100) ** 2;
  const age = ageDays(p.listed_at, asOfMs);
  const isSibling = liveFirstWords.has(firstWord(p.name));
  return {
    p,
    family: familyOf(p.category),
    mechanism: mechanismOf(p.category),
    growth: g,
    projectedTvl,
    seasoning: seasoningFactor(age, coefUsed),
    siblingFactor: isSibling ? 0.5 : 1,
    isSibling,
    onWatchlist,
    ageDays: age,
  };
}

interface ScoreParams {
  a: number;
  b: number;
  effects: Record<string, number>;
}

function impliedOf(s: Scored, params: ScoreParams): { implied: number; curveValue: number } {
  const curveValue = 10 ** (params.a + params.b * Math.log10(s.projectedTvl / 1e8));
  const effect = params.effects[s.family] ?? 1;
  const implied = Math.max(1, Math.round(curveValue * effect * s.seasoning * s.siblingFactor));
  return { implied, curveValue };
}

// ---------------------------------------------------------------- backtests

interface LooOutcome {
  medianMiss: number;
  within3: number;
  within2: number;
  ratios: number[];
  looPred: number[];
  curveOnlyErr: number[];
}

function summarizeErr(absLogErr: number[]): { medianMiss: number; within3: number; within2: number } {
  const med = medianUpper(absLogErr);
  const n = absLogErr.length;
  const log3 = Math.log10(3);
  const log2 = Math.log10(2);
  let w3 = 0;
  let w2 = 0;
  for (const e of absLogErr) {
    if (e <= log3) w3++;
    if (e <= log2) w2++;
  }
  return { medianMiss: 10 ** med, within3: (w3 / n) * 100, within2: (w2 / n) * 100 };
}

function runLoo(comps: Comp[]): LooOutcome {
  const absErr: number[] = [];
  const absErrCurve: number[] = [];
  const ratios: number[] = [];
  const looPred: number[] = [];
  const curveOnlyErr: number[] = [];
  for (let i = 0; i < comps.length; i++) {
    const train = comps.filter((_, j) => j !== i);
    const curve = fitCurve(train);
    const fams = fitFamilies(train, curve);
    const c = comps[i]!;
    const pred = curveValue(c.tvl_usd, curve) * fams[c.family]!.effect;
    const predCurve = curveValue(c.tvl_usd, curve);
    const err = Math.log10(c.mcap_usd) - Math.log10(pred);
    const errC = Math.log10(c.mcap_usd) - Math.log10(predCurve);
    absErr.push(Math.abs(err));
    absErrCurve.push(Math.abs(errC));
    ratios.push(c.mcap_usd / pred);
    looPred.push(pred);
    curveOnlyErr.push(errC);
  }
  return { ...summarizeErr(absErr), ratios, looPred, curveOnlyErr };
}

function runLooFlat(comps: Comp[]): { medianMiss: number; within3: number; within2: number } {
  const absErr: number[] = [];
  for (let i = 0; i < comps.length; i++) {
    const others = comps.filter((_, j) => j !== i).map((c) => c.mcap_usd / c.tvl_usd);
    const med = medianUpper(others);
    const c = comps[i]!;
    absErr.push(Math.abs(Math.log10(c.mcap_usd) - Math.log10(med * c.tvl_usd)));
  }
  return summarizeErr(absErr);
}

function runTimeSplit(comps: Comp[]): {
  model: { medianMiss: number; within3: number; nTrain: number; nTest: number };
  flat: { medianMiss: number; within3: number };
} {
  const train = comps.filter((c) => c.listed_at !== null && c.listed_at < '2024-01-01');
  const test = comps.filter((c) => c.listed_at !== null && c.listed_at >= '2024-01-01');
  const curve = fitCurve(train);
  const fams = fitFamilies(train, curve);
  const medRatio = medianUpper(train.map((c) => c.mcap_usd / c.tvl_usd));
  const absErr: number[] = [];
  const absErrFlat: number[] = [];
  for (const c of test) {
    const pred = curveValue(c.tvl_usd, curve) * fams[c.family]!.effect;
    absErr.push(Math.abs(Math.log10(c.mcap_usd) - Math.log10(pred)));
    absErrFlat.push(Math.abs(Math.log10(c.mcap_usd) - Math.log10(medRatio * c.tvl_usd)));
  }
  const m = summarizeErr(absErr);
  const f = summarizeErr(absErrFlat);
  return {
    model: { medianMiss: m.medianMiss, within3: m.within3, nTrain: train.length, nTest: test.length },
    flat: { medianMiss: f.medianMiss, within3: f.within3 },
  };
}

// ---------------------------------------------------------------- farm plans + economics

const STEP_TXS = [1, 0, 2, 2, 0, 0, 1, 1];
const STEP_MINUTES = [5, 15, 15, 15, 65, 5, 10, 10];

const CORE_VERBS: Record<string, [string, string]> = {
  'Vault curation': [
    "Deposit $1,000 into a curator vault on {chain} in the vault's base asset.",
    'Allocate $100 to a second curator vault — another chain or another mandate — so the wallet appears in two of the protocol\'s own accounting snapshots instead of one.',
  ],
  'Supply and borrow': [
    'Supply $1,000 of collateral on {chain}.',
    'Borrow a small amount against it, then repay it, so the wallet has used both sides of the market.',
  ],
  'Collateralised debt': [
    'Lock $1,000 of collateral on {chain}.',
    "Mint the protocol's stable asset against it, then hold the position.",
  ],
  'Liquidity pool': [
    "Swap $100 on {chain} to learn the pool's price impact.",
    'Provide $900 of liquidity to a pool and hold the LP position.',
  ],
  Derivatives: [
    'Open a small position on {chain} with $200 of margin.',
    'Open a second, different position with $200 more.',
  ],
  'Basis vault': [
    'Deposit $1,000 into the basis vault on {chain}.',
    'Add $100 to a second basis position.',
  ],
  'Real-world yield': [
    'Mint or buy $1,000 of the tokenized asset on {chain}.',
    'Hold it in the protocol for the full 90 days.',
  ],
  Index: [
    'Buy $1,000 of the index on {chain}.',
    'Add $100 in a second index position.',
  ],
  'Yield vault': [
    'Deposit $1,000 into the yield vault on {chain}.',
    'Deposit $100 into a second vault or strategy.',
  ],
  Staking: [
    'Stake $1,000 on {chain}.',
    'Stake a second $100 tranche a week later.',
  ],
  'Chain activity': [
    'Bridge $100 to {chain}.',
    'Use a native app on the chain with the bridged funds.',
  ],
  Payments: [
    'Make a $100 payment through the protocol on {chain}.',
    'Set up a second, recurring payment.',
  ],
  'Private transaction': [
    'Use a private transaction for $100 on {chain}.',
    'Repeat with a second asset.',
  ],
  Cover: [
    'Buy $1,000 of cover on {chain}.',
    'Top up cover by $100.',
  ],
  'Lock and vote': [
    'Lock $1,000 or vote in the current round on {chain}.',
    'Vote in a second round.',
  ],
  'Launch allocation': [
    'Join a launch allocation with $1,000 on {chain}.',
    'Join a second allocation.',
  ],
  Farm: [
    'Deposit $1,000 into the farm on {chain}.',
    'Add $100 to a second farm.',
  ],
  'CeDeFi vault': [
    'Deposit $1,000 into the CeDeFi vault on {chain}.',
    'Add a second $100 position.',
  ],
  'Mint and save': [
    'Mint $1,000 of the stable asset on {chain}.',
    'Save it in the protocol for the full 90 days.',
  ],
  'OTC trade': [
    'Place a small OTC trade of $100 on {chain}.',
    'Place a second OTC trade.',
  ],
  'BTC yield': [
    'Deposit $1,000 of BTC on {chain}.',
    'Add a second $100 BTC position.',
  ],
  Prediction: [
    'Place a $100 prediction on {chain}.',
    'Place a second prediction on a different market.',
  ],
  'Options vault': [
    'Buy a $100 option on {chain}.',
    'Buy a second, different option.',
  ],
  'Leveraged farm': [
    'Open a leveraged farm position with $200 on {chain}.',
    'Open a second leveraged position with $200 more.',
  ],
  'Protocol use': [
    'Deposit $1,000 into the protocol on {chain}.',
    'Use a second feature of the protocol with $100.',
  ],
};

const RISK_VAULT = "Redeem if the share price falls 3% while the vault's asset is flat, or the vault loses a quarter of its TVL in a week.";
const RISK_LEND = 'Unwind if the borrow rate sits above the supply yield for a week, or collateral value falls a quarter.';
const RISK_BASIS = 'Redeem if funding stays negative for a week or the backing report shows less than 100%.';
const RISK_MARKET = 'Exit if the pool or market loses half its TVL in a week, or fees dry up for two weeks.';
const RISK_DEFAULT = 'Exit if TVL falls by a quarter in a week or the team goes silent for a month.';

function riskTrigger(mechanism: string): string {
  if (mechanism === 'Vault curation' || mechanism === 'Yield vault' || mechanism === 'CeDeFi vault' || mechanism === 'Staking') return RISK_VAULT;
  if (mechanism === 'Supply and borrow' || mechanism === 'Collateralised debt' || mechanism === 'BTC yield') return RISK_LEND;
  if (mechanism === 'Basis vault') return RISK_BASIS;
  if (mechanism === 'Liquidity pool' || mechanism === 'Derivatives' || mechanism === 'Options vault' || mechanism === 'Leveraged farm' || mechanism === 'Prediction') return RISK_MARKET;
  return RISK_DEFAULT;
}

function farmSteps(p: Protocol, mechanism: string, planChain: string, sliceUsd: number): string[] {
  const verbs = CORE_VERBS[mechanism] ?? CORE_VERBS['Protocol use']!;
  const fill = (t: string): string => t.replaceAll('{chain}', planChain);
  return [
    `Fresh wallet on ${planChain} with $1,000 of USDC and some ${nativeOf(planChain)} for gas, so the position is easy to track.`,
    `Reach ${p.name} from its DefiLlama listing, not a search ad. Check the contracts, the audits and whether a points page exists.`,
    fill(verbs[0]),
    fill(verbs[1]),
    'Each week for 13 weeks, check the points page and the position in about 5 minutes, and track the protocol\'s own announcements.',
    riskTrigger(mechanism),
    `If a token launches, claim only from the official app. At the implied value a 10% drop pro rata to TVL pays this position about $${money(sliceUsd)}.`,
    'Withdraw after 90 days or the claim. Idle dollars here forgo 4% a year in T-bills.',
  ];
}

/** Cheapest chain by the gas table; ties keep the first-listed chain. */
export function planChainOf(chains: string[]): { chain: string; gas: number } {
  let best = chains[0] ?? 'Ethereum';
  let bestGas = gasOf(best);
  for (const c of chains) {
    const g = gasOf(c);
    if (g < bestGas) {
      best = c;
      bestGas = g;
    }
  }
  return { chain: best, gas: bestGas };
}

export function tbillOf(capital: number): number {
  return capital * TBILL_RATE * (HOLD_DAYS / 365);
}

export function sliceOf(capital: number, share: number, tvl: number, value: number): number {
  return (capital / (tvl + capital)) * share * value;
}

export function verdictOf(slice: number, fees: number, net: number): string {
  if (net > 0) return 'FARM';
  if (slice > fees) return 'THIN';
  return 'SKIP';
}

function netAt(capital: number, tvl: number, value: number, fees: number): number {
  return sliceOf(capital, AIRDROP_SHARE, tvl, value) - fees - tbillOf(capital);
}

/**
 * The capital at which net turns positive. Closed form while it stays small
 * against TVL; an exact bisection on net(c) when the closed form overshoots
 * TVL/10 (the linear slice approximation breaks down there). Rounded up to
 * the next $100, capped at $100,000, null when it never pays.
 */
export function paysFrom(tvl: number, value: number, fees: number): number | null {
  const denom = (AIRDROP_SHARE * value) / tvl - TBILL_RATE * (HOLD_DAYS / 365);
  if (denom <= 0) return null;
  const closed = fees / denom;
  let root: number | null = null;
  if (closed <= tvl / 10) {
    root = closed;
  } else {
    // Scan a log grid for the first sign change of net(c), then bisect it.
    let prevC = 100;
    let prevN = netAt(prevC, tvl, value, fees);
    let lo = -1;
    let hi = -1;
    for (let k = 1; k <= 200; k++) {
      const c = 100 * 10 ** ((k / 200) * 4); // 100 .. 1,000,000
      const n = netAt(c, tvl, value, fees);
      if (prevN < 0 && n >= 0) {
        lo = prevC;
        hi = c;
        break;
      }
      prevC = c;
      prevN = n;
    }
    if (lo > 0) {
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        if (netAt(mid, tvl, value, fees) < 0) lo = mid;
        else hi = mid;
      }
      root = hi;
    }
  }
  if (root === null) return null;
  const rounded = Math.max(100, Math.ceil(root / 100) * 100);
  return Math.min(100000, rounded);
}

// ---------------------------------------------------------------- build

export function buildBoard(snapshot: Snapshot): RadarBuild {
  const asOfMs = Date.parse(`${snapshot.as_of}T00:00:00Z`);
  if (Number.isNaN(asOfMs)) throw new Error('snapshot as_of is not a date');
  const watchlist = new Set(snapshot.watchlist);
  if (watchlist.size === 0) throw new Error('snapshot watchlist is empty');

  const liveFirstWords = new Set<string>();
  const liveRows: LiveRow[] = [];
  const preToken: Protocol[] = [];
  for (const p of snapshot.protocols) {
    if (recordsNoToken(p)) {
      preToken.push(p);
    } else {
      liveFirstWords.add(firstWord(p.name));
      liveRows.push({
        slug: p.slug,
        name: p.name,
        category: p.category,
        chains: [...p.chains],
        tvl_usd: p.tvl_usd,
        mcap_usd: p.mcap_usd,
        ratio: p.mcap_usd === null ? null : roundN(p.mcap_usd / p.tvl_usd, 4),
      });
    }
  }
  liveRows.sort((a, b) => {
    const ma = a.mcap_usd ?? -1;
    const mb = b.mcap_usd ?? -1;
    if (mb !== ma) return mb - ma;
    return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
  });

  // Set aside vs rankable, first matching rule wins.
  const asideRows: AsideRow[] = [];
  const asideCounts: Record<string, number> = {};
  const rankable: Protocol[] = [];
  for (const p of preToken) {
    const reason = asideReason(p, liveFirstWords, watchlist.has(p.slug));
    if (reason !== null) {
      asideCounts[reason] = (asideCounts[reason] ?? 0) + 1;
      asideRows.push({ slug: p.slug, name: p.name, category: p.category, chains: [...p.chains], tvl_usd: p.tvl_usd, reason });
    } else {
      rankable.push(p);
    }
  }
  asideRows.sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const asideTop40 = asideRows.slice(0, 40);
  const asideCountsSorted: Record<string, number> = {};
  for (const k of Object.keys(asideCounts).sort()) asideCountsSorted[k] = asideCounts[k]!;

  // Fit the model on the comparables.
  const comps = buildComparables(snapshot.protocols, asOfMs);
  if (comps.length === 0) throw new Error('no comparables: no live protocol has both mcap and TVL');
  const curve = fitCurve(comps);
  const fams = fitFamilies(comps, curve);
  const season = fitSeasoning(comps, curve, fams);

  // Backtests (leave-one-out refits drive the intervals too).
  const loo = runLoo(comps);
  const looCurve = summarizeErr(loo.curveOnlyErr.map((e) => Math.abs(e)));
  const looFlat = runLooFlat(comps);
  const split = runTimeSplit(comps);
  const sortedRatios = [...loo.ratios].sort((a, b) => a - b);
  const q10 = percentileRank(sortedRatios, 0.1);
  const q25 = percentileRank(sortedRatios, 0.25);
  const q75 = percentileRank(sortedRatios, 0.75);
  const q90 = percentileRank(sortedRatios, 0.9);
  let inside = 0;
  for (const r of loo.ratios) if (r >= q10 && r <= q90) inside++;
  const bandCoverage = (inside / loo.ratios.length) * 100;

  // Factor check: curve-only LOO residuals vs growth and vs log age.
  const gx: number[] = [];
  const gy: number[] = [];
  const ax: number[] = [];
  const ay: number[] = [];
  for (let i = 0; i < comps.length; i++) {
    const c = comps[i]!;
    if (c.change_7d !== null) {
      gx.push(c.change_7d);
      gy.push(loo.curveOnlyErr[i]!);
    }
    if (c.age_days !== null && c.age_days >= 1) {
      ax.push(Math.log10(c.age_days));
      ay.push(loo.curveOnlyErr[i]!);
    }
  }
  const backtest: Backtest = {
    loo: { median_miss: roundN(loo.medianMiss, 2), within3: roundN(loo.within3, 1), within2: roundN(loo.within2, 1) },
    loo_curve: { median_miss: roundN(looCurve.medianMiss, 2), within3: roundN(looCurve.within3, 1), within2: roundN(looCurve.within2, 1) },
    loo_flat: { median_miss: roundN(looFlat.medianMiss, 2), within3: roundN(looFlat.within3, 1), within2: roundN(looFlat.within2, 1) },
    time_split: { median_miss: roundN(split.model.medianMiss, 2), within3: roundN(split.model.within3, 1), n_train: split.model.nTrain, n_test: split.model.nTest },
    time_split_flat: { median_miss: roundN(split.flat.medianMiss, 2), within3: roundN(split.flat.within3, 1) },
    band: { p10: roundN(q10, 2), p90: roundN(q90, 2), coverage: roundN(bandCoverage, 1) },
    factor_check: { r_growth: roundN(pearson(gx, gy), 2), r_age: roundN(pearson(ax, ay), 2) },
  };

  // Score every rankable protocol.
  const scored = rankable.map((p) => prepareScored(p, liveFirstWords, watchlist.has(p.slug), season.coef_used, asOfMs));
  const baseEffects: Record<string, number> = {};
  for (const fam of FAMILY_ORDER) baseEffects[fam] = fams[fam]!.effect;
  const baseParams: ScoreParams = { a: curve.a, b: curve.b, effects: baseEffects };

  const tbill = round2(tbillOf(CAPITAL_USD));
  interface RowDraft {
    s: Scored;
    implied: number;
    curveValue: number;
    fees: number;
    slice: number;
    net: number;
    verdict: string;
    perHour: number;
    paysFrom: number | null;
    planChain: string;
    gas: number;
  }
  const drafts: RowDraft[] = scored.map((s) => {
    const { implied, curveValue } = impliedOf(s, baseParams);
    const { chain, gas } = planChainOf(s.p.chains);
    const bridge = chain !== 'Ethereum' && s.p.chains.length > 1 ? BRIDGE_ALLOWANCE : 0;
    const fees = round2(PLAN_TXS * gas + bridge);
    const slice = round2(sliceOf(CAPITAL_USD, AIRDROP_SHARE, s.p.tvl_usd, implied));
    const net = round2(slice - fees - tbill);
    const verdict = verdictOf(slice, fees, net);
    return {
      s,
      implied,
      curveValue,
      fees,
      slice,
      net,
      verdict,
      perHour: round2(net / (WORK_MINUTES / 60)),
      paysFrom: paysFrom(s.p.tvl_usd, implied, fees),
      planChain: chain,
      gas,
    };
  });

  // Rank by implied value desc, then TVL desc, then slug asc.
  drafts.sort((x, y) => {
    if (y.implied !== x.implied) return y.implied - x.implied;
    if (y.s.p.tvl_usd !== x.s.p.tvl_usd) return y.s.p.tvl_usd - x.s.p.tvl_usd;
    return x.s.p.slug < y.s.p.slug ? -1 : x.s.p.slug > y.s.p.slug ? 1 : 0;
  });

  const rows: BoardRow[] = drafts.map((d, i) => {
    const s = d.s;
    const p = s.p;
    return {
      rank: i + 1,
      slug: p.slug,
      name: p.name,
      category: p.category,
      family: s.family,
      mechanism: s.mechanism,
      chains: [...p.chains],
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      mcap_usd: null,
      listed_at: p.listed_at,
      age_days: s.ageDays,
      implied_value_usd: d.implied,
      p10_usd: Math.max(1, Math.round(d.implied * q10)),
      p90_usd: Math.max(1, Math.round(d.implied * q90)),
      p25_usd: Math.max(1, Math.round(d.implied * q25)),
      p75_usd: Math.max(1, Math.round(d.implied * q75)),
      token_status: 'pre-token',
      watchlist: s.onWatchlist,
      sibling: s.isSibling,
      early: s.ageDays !== null && s.ageDays < 180,
      model: {
        curve_value_usd: round2(d.curveValue),
        family_effect: fams[s.family]!.effect,
        family_peer_count: fams[s.family]!.n,
        growth_pct: s.growth,
        projected_tvl_usd: Math.round(s.projectedTvl),
        seasoning: s.seasoning,
        sibling_factor: s.siblingFactor,
      },
      econ: {
        slice_usd: d.slice,
        fees_usd: d.fees,
        tbill_usd: tbill,
        net_usd: d.net,
        verdict: d.verdict,
        work_minutes: WORK_MINUTES,
        per_hour_usd: d.perHour,
        pays_from_usd: d.paysFrom,
        plan_chain: d.planChain,
        gas_usd: d.gas,
      },
      farm_steps: farmSteps(p, s.mechanism, d.planChain, d.slice),
    };
  });

  // Sensitivity scenarios: same scoring function, perturbed parameters.
  const draftBySlug = new Map<string, RowDraft>();
  const baseVerdictBySlug = new Map<string, string>();
  for (const d of drafts) draftBySlug.set(d.s.p.slug, d);
  for (const r of rows) baseVerdictBySlug.set(r.slug, r.econ.verdict);
  const scenarioDefs: { name: string; params: ScoreParams }[] = [
    { name: 'base', params: baseParams },
    { name: 'slope−', params: { a: curve.a, b: curve.b - 0.05, effects: baseEffects } },
    { name: 'slope+', params: { a: curve.a, b: curve.b + 0.05, effects: baseEffects } },
    { name: 'family×0.8', params: { a: curve.a, b: curve.b, effects: scaleEffects(baseEffects, 0.8) } },
    { name: 'family×1.25', params: { a: curve.a, b: curve.b, effects: scaleEffects(baseEffects, 1.25) } },
  ];
  const scenarios: SensitivityScenario[] = scenarioDefs.map((def) => {
    const values: number[] = [];
    const counts = { farm: 0, thin: 0, skip: 0 };
    let changes = 0;
    for (const s of scored) {
      const { implied } = impliedOf(s, def.params);
      values.push(implied);
      const d = draftBySlug.get(s.p.slug)!;
      const slice = round2(sliceOf(CAPITAL_USD, AIRDROP_SHARE, s.p.tvl_usd, implied));
      const net = round2(slice - d.fees - tbill);
      const verdict = verdictOf(slice, d.fees, net);
      if (verdict === 'FARM') counts.farm++;
      else if (verdict === 'THIN') counts.thin++;
      else counts.skip++;
      if (verdict !== baseVerdictBySlug.get(s.p.slug)) changes++;
    }
    values.sort((a, b) => a - b);
    return {
      name: def.name,
      median_implied_usd: values[Math.floor(values.length / 2)]!,
      top1_implied_usd: values[values.length - 1]!,
      verdicts: counts,
      verdict_changes: changes,
    };
  });

  // Totals.
  const totalImplied = rows.reduce((n, r) => n + r.implied_value_usd, 0);
  const sortedImplied = rows.map((r) => r.implied_value_usd).sort((a, b) => a - b);
  const verdictTotals = { farm: 0, thin: 0, skip: 0 };
  for (const r of rows) {
    if (r.econ.verdict === 'FARM') verdictTotals.farm++;
    else if (r.econ.verdict === 'THIN') verdictTotals.thin++;
    else verdictTotals.skip++;
  }

  const familiesMeta: Record<string, { effect: number; n: number }> = {};
  for (const fam of FAMILY_ORDER) {
    familiesMeta[fam] = { effect: roundN(fams[fam]!.effect, 3), n: fams[fam]!.n };
  }

  const compsOut: CompOut[] = comps
    .map((c, i) => ({ tvl_usd: c.tvl_usd, mcap_usd: c.mcap_usd, name: c.name, family: c.family, loo: Math.round(loo.looPred[i]!) }))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  const meta: RadarMeta = {
    as_of: snapshot.as_of,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    curve: { a: roundN(curve.a, 4), b: roundN(curve.b, 4), r2: roundN(curve.r2, 4), n_comps: curve.n },
    families: familiesMeta,
    seasoning: { coef_fitted: roundN(season.coef_fitted, 4), coef_used: roundN(season.coef_used, 4) },
    backtest,
    sensitivity: { scenarios },
    economics: { capital_usd: CAPITAL_USD, hold_days: HOLD_DAYS, tbill_rate: TBILL_RATE, airdrop_share: AIRDROP_SHARE, work_minutes: WORK_MINUTES },
    totals: {
      protocols_scanned: snapshot.protocols.length,
      ranked: rows.length,
      watchlist: watchlist.size,
      set_aside: asideRows.length,
      live: liveRows.length,
      total_implied_usd: totalImplied,
      median_implied_usd: sortedImplied[Math.floor(sortedImplied.length / 2)]!,
      verdicts: verdictTotals,
    },
  };

  return {
    rows,
    live_rows: liveRows,
    aside_rows: asideTop40,
    aside_counts: asideCountsSorted,
    comps: compsOut,
    meta,
    debug: {
      curve,
      families: fams,
      coef_fitted: season.coef_fitted,
      coef_used: season.coef_used,
      q10,
      q25,
      q75,
      q90,
      n_pre_token: preToken.length,
      n_set_aside: asideRows.length,
    },
  };
}

function scaleEffects(effects: Record<string, number>, f: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of Object.keys(effects)) out[k] = effects[k]! * f;
  return out;
}
