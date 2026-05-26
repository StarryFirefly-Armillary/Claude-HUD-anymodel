#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const input = (() => {
  let d = '';
  const buf = Buffer.alloc(65536);
  let n;
  while ((n = fs.readSync(0, buf)) > 0) d += buf.toString('utf8', 0, n);
  return d;
})();

let D;
try { D = JSON.parse(input); } catch { D = {}; }

// --- Cache: smooth out transient null spikes within a session ---
const cacheFile = path.join(__dirname, '.hud-cache.json');
let cache = {};
try {
  cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  if (!cache.ts || Date.now() - cache.ts > 120000) cache = {};
} catch {}

const ctx = D.context_window;
let model = D.model?.display_name || D.model?.id || '?';

// Check if proxy switched model (e.g. for images)
try {
  const mState = JSON.parse(fs.readFileSync(path.join(__dirname, '.hud-model-state.json'), 'utf8'));
  if (mState.actual && mState.ts && Date.now() - mState.ts < 300000) {
    model = mState.actual;
  }
} catch {}
let usedPct = ctx?.used_percentage ?? null;
let ctxSize = ctx?.context_window_size ?? null;
let inTok = ctx?.total_input_tokens ?? ctx?.current_usage?.input_tokens ?? null;
let outTok = ctx?.total_output_tokens ?? ctx?.current_usage?.output_tokens ?? null;
let cost = D.cost?.total_cost_usd ?? null;
let rate5h = D.rate_limits?.five_hour?.used_percentage ?? null;

// Restore from cache when current is null or 0 (transient spike)
if ((usedPct == null || usedPct === 0) && cache.pct > 0) usedPct = cache.pct;
if (ctxSize == null && cache.ctxSize != null) ctxSize = cache.ctxSize;
if (inTok == null && cache.inTok != null) inTok = cache.inTok;
if (outTok == null && cache.outTok != null) outTok = cache.outTok;
if (cost == null && cache.cost != null) cost = cache.cost;
if (rate5h == null && cache.rate5h != null) rate5h = cache.rate5h;

// Fallback: compute percentage from tokens if still missing
if ((usedPct == null || usedPct === 0) && inTok > 0 && ctxSize > 0)
  usedPct = (inTok / ctxSize) * 100;

// Update cache: only store values that are actively present in current data
const next = { ts: Date.now() };
if (ctx?.used_percentage > 0) next.pct = ctx.used_percentage;
else if (cache.pct > 0) next.pct = cache.pct;
if (usedPct > 0) next.pct = usedPct; // also cache computed value
if (ctx?.context_window_size > 0) next.ctxSize = ctx.context_window_size;
else if (cache.ctxSize > 0) next.ctxSize = cache.ctxSize;
if (ctx?.total_input_tokens > 0 || ctx?.current_usage?.input_tokens > 0) next.inTok = inTok;
else if (cache.inTok > 0) next.inTok = cache.inTok;
if (ctx?.total_output_tokens > 0 || ctx?.current_usage?.output_tokens > 0) next.outTok = outTok;
else if (cache.outTok > 0) next.outTok = cache.outTok;
if (D.cost?.total_cost_usd > 0) next.cost = cost;
else if (cache.cost > 0) next.cost = cache.cost;
if (D.rate_limits?.five_hour?.used_percentage > 0) next.rate5h = rate5h;
else if (cache.rate5h > 0) next.rate5h = cache.rate5h;
try { fs.writeFileSync(cacheFile, JSON.stringify(next)); } catch {}

// --- Colors ---
const R = '\x1b[0m', G = '\x1b[32m', Y = '\x1b[33m', RD = '\x1b[31m', DM = '\x1b[2m';
function cp(p) { return p == null ? '' : p > 85 ? RD : p > 60 ? Y : G; }
function cr(p) { return p == null ? '' : p > 90 ? RD : p > 70 ? Y : ''; }
function bar(p, w) {
  if (p == null) return DM + '?'.repeat(w) + R;
  const f = Math.round((p / 100) * w);
  return cp(p) + '█'.repeat(f) + R + DM + '░'.repeat(w - f) + R;
}
function fmtTok(n) {
  if (n == null || n === 0) return '?';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

// --- Render ---
const pStr = usedPct != null ? cp(usedPct) + usedPct.toFixed(1) + '%' + R : DM + '?' + R;
const parts = [model, `ctx ${pStr} [${bar(usedPct, 15)}]`, `${DM}in${R} ${fmtTok(inTok)}  ${DM}out${R} ${fmtTok(outTok)}`];
if (cost != null && cost > 0) parts.push('$' + cost.toFixed(2));
if (rate5h != null) { const c = cr(rate5h); parts.push(`5h ${c}${rate5h.toFixed(0)}%${c ? R : ''}`); }
process.stdout.write(parts.join('  ') + '\n');
