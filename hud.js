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

// --- Cache: smooth out transient null/0 spikes ---
const cacheFile = path.join(__dirname, '.hud-cache.json');
let cache = {};
try { cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch {}

const ctx = D.context_window;
const model = D.model?.display_name || D.model?.id || '?';
let usedPct = ctx?.used_percentage ?? null;
let inTok = ctx?.total_input_tokens ?? ctx?.current_usage?.input_tokens ?? null;
let outTok = ctx?.total_output_tokens ?? ctx?.current_usage?.output_tokens ?? null;
let cost = D.cost?.total_cost_usd ?? null;
let rate5h = D.rate_limits?.five_hour?.used_percentage ?? null;

// Use cached values when current is null/0 but we had a valid previous value
if (usedPct == null && cache.pct != null) usedPct = cache.pct;
if (inTok == null && cache.inTok != null) inTok = cache.inTok;
if (outTok == null && cache.outTok != null) outTok = cache.outTok;
if (cost == null && cache.cost != null) cost = cache.cost;
if (rate5h == null && cache.rate5h != null) rate5h = cache.rate5h;

// Update cache with valid values (null means unknown, don't overwrite)
const next = { ...cache };
if (ctx?.used_percentage != null) next.pct = ctx.used_percentage;
if (inTok != null) next.inTok = inTok;
if (outTok != null) next.outTok = outTok;
if (cost != null) next.cost = cost;
if (rate5h != null) next.rate5h = rate5h;
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
const parts = [model, `ctx ${pStr} [${bar(usedPct, 15)}]`, `${fmtTok(inTok)}/${fmtTok(outTok)}`];
if (cost != null) parts.push('$' + cost.toFixed(2));
if (rate5h != null) { const c = cr(rate5h); parts.push(`5h ${c}${rate5h.toFixed(0)}%${c ? R : ''}`); }
process.stdout.write(parts.join('  ') + '\n');
