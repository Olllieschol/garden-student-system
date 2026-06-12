/**
 * GuardAI — background.js  (Manifest V3 service worker, ES module)
 * ---------------------------------------------------------------------------
 * Coordinates session statistics and storage defaults. It does NO network I/O.
 *
 * Stats live in chrome.storage.local under `guardai_stats`:
 *   {
 *     detected:      total sensitive items seen this session
 *     masked:        total items masked this session
 *     sentUnmasked:  times the user chose "send anyway"
 *     platforms:     { ChatGPT: 3, Claude: 1, ... }  usage counts
 *     sessionStart:  timestamp the current session began
 *   }
 *
 * "Session" = since the browser last started (reset in onStartup).
 * ---------------------------------------------------------------------------
 */

const STATS_KEY = "guardai_stats";

const DEFAULT_STATS = () => ({
  detected: 0,
  masked: 0,
  sentUnmasked: 0,
  platforms: {},
  sessionStart: Date.now(),
});

const DEFAULT_SETTINGS = {
  guardai_enabled: true,
  guardai_masking_enabled: false,
};

/* ------------------------------------------------------------------ *
 * Lifecycle: set sensible defaults on first install; reset session
 * stats whenever the browser starts a fresh session.
 * ------------------------------------------------------------------ */
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  const toSet = {};
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    if (existing[k] === undefined) toSet[k] = v;
  }
  toSet[STATS_KEY] = DEFAULT_STATS();
  await chrome.storage.local.set(toSet);
});

chrome.runtime.onStartup.addListener(async () => {
  // New browser session -> fresh stats (mapping table is intentionally kept).
  await chrome.storage.local.set({ [STATS_KEY]: DEFAULT_STATS() });
});

/* ------------------------------------------------------------------ *
 * Message handling from content scripts.
 * ------------------------------------------------------------------ */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== "GUARDAI_STATS") return;

  // Run async work, then respond. Return true to keep the channel open.
  recordStats(msg).then((stats) => sendResponse({ ok: true, stats }));
  return true;
});

async function recordStats(msg) {
  const data = await chrome.storage.local.get(STATS_KEY);
  const stats = data[STATS_KEY] || DEFAULT_STATS();

  if (typeof msg.detected === "number") stats.detected += msg.detected;
  if (typeof msg.masked === "number") stats.masked += msg.masked;
  if (typeof msg.sentUnmasked === "number") stats.sentUnmasked += msg.sentUnmasked;

  if (msg.platform) {
    stats.platforms[msg.platform] = (stats.platforms[msg.platform] || 0) + 1;
  }

  await chrome.storage.local.set({ [STATS_KEY]: stats });
  return stats;
}
