/**
 * GuardAI — popup.js
 * ---------------------------------------------------------------------------
 * Privacy dashboard logic. Reads/writes chrome.storage.local only.
 * Shows session stats, computes a privacy score, and exposes the master
 * enable toggle, the masking toggle, and the "clear mapping table" action.
 * ---------------------------------------------------------------------------
 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  /* ---- Dark / light mode ---- */
  const THEME_KEY = "guardai_theme";
  function applyTheme(dark) {
    document.documentElement.classList.toggle("gd-dark", dark);
    const btn = $("theme-toggle");
    if (btn) btn.textContent = dark ? "\u263D" : "\u2600"; // moon : sun
  }
  // Load preference instantly (before render) to avoid flash.
  const savedTheme = localStorage.getItem(THEME_KEY);
  applyTheme(savedTheme === "dark");

  const els = {
    enabled: $("toggle-enabled"),
    masking: $("toggle-masking"),
    scoreValue: $("score-value"),
    scoreRing: $("score-ring"),
    scoreHint: $("score-hint"),
    detected: $("stat-detected"),
    masked: $("stat-masked"),
    sent: $("stat-sent"),
    platformList: $("platform-list"),
    swapList: $("swap-list"),
    mapCount: $("map-count"),
    clearMap: $("clear-map"),
    privacyLink: $("privacy-link"),
  };

  /* ---- Load everything from storage and paint the UI ---- */
  async function render() {
    const data = await chrome.storage.local.get([
      "guardai_enabled",
      "guardai_masking_enabled",
      "guardai_stats",
      "guardai_mapping",
    ]);

    const enabled = data.guardai_enabled !== false;
    const masking = data.guardai_masking_enabled === true;
    const stats = data.guardai_stats || {
      detected: 0,
      masked: 0,
      sentUnmasked: 0,
      platforms: {},
    };
    const mapping = data.guardai_mapping || [];

    els.enabled.checked = enabled;
    els.masking.checked = masking;
    document.body.classList.toggle("gd-disabled", !enabled);

    els.detected.textContent = stats.detected || 0;
    els.masked.textContent = stats.masked || 0;
    els.sent.textContent = stats.sentUnmasked || 0;
    els.mapCount.textContent = mapping.length;

    renderPlatforms(stats.platforms || {});
    renderSwaps(mapping);
    renderScore(stats);
  }

  /**
   * Show the most recent real -> fake swaps, newest first, derived straight
   * from the local mapping table. Passwords/secrets are never shown in clear.
   */
  function renderSwaps(mapping) {
    if (!mapping.length) {
      els.swapList.innerHTML = '<span class="gd-empty">No data masked yet.</span>';
      return;
    }
    const recent = [...mapping]
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 12);

    els.swapList.innerHTML = recent
      .map((e) => {
        const real = e.type === "PASSWORD" ? "\u2022\u2022\u2022\u2022\u2022\u2022" : e.real;
        const type = (e.type || "").replace(/_/g, " ").toLowerCase();
        return (
          `<div class="gd-swap">` +
          `<span class="gd-swap__real" title="${escapeHtml(real)}">${escapeHtml(real)}</span>` +
          `<span class="gd-swap__arrow">&rarr;</span>` +
          `<span class="gd-swap__fake" title="${escapeHtml(e.fake)}">${escapeHtml(e.fake)}</span>` +
          `<span class="gd-swap__type">${escapeHtml(type)}</span>` +
          `</div>`
        );
      })
      .join("");
  }

  function renderPlatforms(platforms) {
    const names = Object.keys(platforms);
    if (!names.length) {
      els.platformList.innerHTML = '<span class="gd-empty">No AI platforms used yet.</span>';
      return;
    }
    els.platformList.innerHTML = names
      .map(
        (n) =>
          `<span class="gd-chip">${escapeHtml(n)}<span class="gd-chip__count">${platforms[n]}</span></span>`
      )
      .join("");
  }

  /**
   * Privacy score (0-100). Start at 100. Detecting data is fine; the risk is
   * sending it UNMASKED. Masking earns back protection.
   *   - each unmasked send: -12
   *   - masking ratio bonus: up to +0 (keeps you at 100 when you always mask)
   */
  function renderScore(stats) {
    const detected = stats.detected || 0;
    const masked = stats.masked || 0;
    const sent = stats.sentUnmasked || 0;

    let score = 100 - sent * 12;
    // If sensitive data was detected but little was masked, nudge down.
    if (detected > 0) {
      const maskRatio = masked / detected;
      if (maskRatio < 0.5) score -= Math.round((1 - maskRatio) * 10);
    }
    score = Math.max(0, Math.min(100, score));

    els.scoreValue.textContent = score;
    els.scoreRing.style.setProperty("--pct", score + "%");

    let color = "var(--accent)";
    let hint = "You're protected. Keep masking sensitive data.";
    if (score < 50) {
      color = "var(--danger)";
      hint = "High exposure — you've sent sensitive data unmasked. Turn on masking mode.";
    } else if (score < 80) {
      color = "var(--warn)";
      hint = "Some data was sent unmasked. Consider enabling masking mode.";
    } else if (detected === 0) {
      hint = "You're protected. Nothing risky sent yet.";
    }
    els.scoreRing.style.background = `radial-gradient(closest-side, var(--bg-card) 79%, transparent 80%), conic-gradient(${color} ${score}%, #30363d 0)`;
    els.scoreHint.textContent = hint;
  }

  /* ---- Wire up controls ---- */
  $("theme-toggle").addEventListener("click", () => {
    const dark = !document.documentElement.classList.contains("gd-dark");
    applyTheme(dark);
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  });

  els.enabled.addEventListener("change", async () => {
    await chrome.storage.local.set({ guardai_enabled: els.enabled.checked });
    document.body.classList.toggle("gd-disabled", !els.enabled.checked);
  });

  els.masking.addEventListener("change", async () => {
    await chrome.storage.local.set({ guardai_masking_enabled: els.masking.checked });
  });

  els.clearMap.addEventListener("click", async () => {
    await chrome.storage.local.remove("guardai_mapping");
    await render();
    flash(els.clearMap, "Cleared");
  });

  els.privacyLink.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL("privacy-policy.html") });
  });

  // Live-refresh if storage changes while the popup is open.
  chrome.storage.onChanged.addListener((_changes, area) => {
    if (area === "local") render();
  });

  function flash(btn, text) {
    const original = btn.textContent;
    btn.textContent = text;
    setTimeout(() => (btn.textContent = original), 1200);
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  render();
})();
