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
  // Expire cache after 2 minutes (new session = fresh start)
  if (!cache.ts || Date.now() - cache.ts > 120000) cache = {};
} catch {}

const ctx = D.context_window;
const model = D.model?.display_name || D.model?.id || '?';
let usedPct = ctx?.used_percentage ?? null;
let ctxSize = ctx?.context_window_size ?? null;
let inTok = ctx?.total_input_tokens ?? ctx?.current_usage?.input_tokens ?? null;
let outTok = ctx?.total_output_tokens ?? ctx?.current_usage?.output_tokens ?? null;
let cost = D.cost?.total_cost_usd ?? null;
let rate5h = D.rate_limits?.five_hour?.used_percentage ?? null;

// Restore from cache when current is null (transient spike)
if (usedPct == null && cache.pct != null) usedPct = cache.pct;
if (ctxSize == null && cache.ctxSize != null) ctxSize = cache.ctxSize;
if (inTok == null && cache.inTok != null) inTok = cache.inTok;
if (outTok == null && cache.outTok != null) outTok = cache.outTok;
if (cost == null && cache.cost != null) cost = cache.cost;
if (rate5h == null && cache.rate5h != null) rate5h = cache.rate5h;

// Update cache: only store non-null, non-zero values (0 at session start is meaningless)
const next = { ts: Date.now() };
if (ctx?.used_percentage > 0) next.pct = ctx.used_percentage;
else if (cache.pct > 0) next.pct = cache.pct;
if (ctx?.context_window_size > 0) next.ctxSize = ctx.context_window_size;
else if (cache.ctxSize > 0) next.ctxSize = cache.ctxSize;
if (inTok > 0) next.inTok = inTok;
else if (cache.inTok > 0) next.inTok = cache.inTok;
if (outTok > 0) next.outTok = outTok;
else if (cache.outTok > 0) next.outTok = cache.outTok;
if (cost > 0) next.cost = cost;
else if (cache.cost > 0) next.cost = cache.cost;
if (rate5h > 0) next.rate5h = rate5h;
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
  if (n == null) return '?';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

// --- Render ---
const pStr = usedPct != null ? cp(usedPct) + usedPct.toFixed(1) + '%' + R : DM + '?' + R;
const ctxStr = ctxSize != null ? ` (${fmtTok(inTok ?? 0)}/${fmtTok(ctxSize)})` : '';
const parts = [model, `ctx ${pStr}${ctxStr} [${bar(usedPct, 15)}]`, `${DM}in${R} ${fmtTok(inTok)}  ${DM}out${R} ${fmtTok(outTok)}`];
if (cost != null) parts.push('$' + cost.toFixed(2));
if (rate5h != null) { const c = cr(rate5h); parts.push(`5h ${c}${rate5h.toFixed(0)}%${c ? R : ''}`); }
process.stdout.write(parts.join('  ') + '\n');
