/**
 * GuardAI — content.js
 * ---------------------------------------------------------------------------
 * The orchestrator injected into supported AI chat sites. It ties together:
 *   - detector.js      (find sensitive data)
 *   - nlp-detector.js  (optional contextual NER)
 *   - masker.js        (swap real <-> fake)
 *
 * Responsibilities
 *   1. Locate the chat input field (textarea or contenteditable).
 *   2. Intercept the "send" action (Enter key / send button) in capture phase.
 *   3. If masking is OFF and sensitive data is found -> show a non-blocking
 *      warning popup (Send anyway / Cancel / Mask & send).
 *   4. If masking is ON -> replace real data with fakes in-place, then send.
 *   5. Watch the conversation for AI responses and swap fakes back to real
 *      data so the user only ever reads their real information.
 *
 * Everything is local. No network calls are made from this script.
 * ---------------------------------------------------------------------------
 */
(function () {
  "use strict";

  const { Detector, NlpDetector, Masker } = window.GuardAI;

  /* ------------------------------------------------------------------ *
   * Per-platform configuration.
   * Selectors are intentionally broad with fallbacks because these sites
   * change their DOM frequently. `editor` finds the input; `sendButton`
   * finds the submit control; `responseRoot` is the area we unmask.
   * ------------------------------------------------------------------ */
  /**
   * Generic fallback config for platforms we don't have hand-tuned selectors
   * for. Broad selectors cover the overwhelmingly common cases: a single
   * textarea or a single contenteditable, with a send button identified by its
   * label/type. `<main>` is the usual response container.
   */
  function genericConfig(name, note) {
    return {
      name,
      editor: [
        "textarea",
        "div[contenteditable='true']",
        "[role='textbox']",
      ],
      sendButton: [
        "button[type='submit']",
        "button[aria-label*='Send' i]",
        "button[aria-label*='Submit' i]",
        "button[data-testid*='send' i]",
      ],
      responseRoot: ["main", "div[role='main']", "div[role='presentation']"],
      note,
    };
  }

  const GENERIC_NOTE =
    "This AI service may store and review what you send; avoid sharing personal IDs, credentials or financial data.";

  const PLATFORMS = {
    "chatgpt.com": chatGPTConfig(),
    "chat.openai.com": chatGPTConfig(),
    "claude.ai": {
      name: "Claude",
      editor: ['div[contenteditable="true"].ProseMirror', 'div[contenteditable="true"]'],
      sendButton: ['button[aria-label="Send message"]', 'button[aria-label*="Send"]'],
      responseRoot: ["div.flex-1.flex.flex-col", "main"],
      responseMessage: ['div.font-claude-message', '[data-testid="assistant-turn"]'],
      userMessage: ['[data-testid="user-message"]', 'div.font-user-message'],
      note: "Anthropic states consumer chats may be reviewed for safety; avoid sharing personal IDs.",
    },
    "gemini.google.com": {
      name: "Gemini",
      editor: ["div.ql-editor[contenteditable='true']", "rich-textarea div[contenteditable='true']"],
      sendButton: ["button[aria-label*='Send']", "button.send-button"],
      responseRoot: ["main", "chat-window"],
      responseMessage: ["message-content", ".model-response-text"],
      userMessage: ["user-query-content", ".user-query-bubble-with-background", ".query-text"],
      note: "Google may use Gemini activity to improve products; reviewers can read conversations.",
    },
    "bard.google.com": {
      name: "Gemini",
      editor: ["div.ql-editor[contenteditable='true']", "rich-textarea div[contenteditable='true']"],
      sendButton: ["button[aria-label*='Send']", "button.send-button"],
      responseRoot: ["main", "chat-window"],
      responseMessage: ["message-content", ".model-response-text"],
      userMessage: ["user-query-content", ".user-query-bubble-with-background", ".query-text"],
      note: "Google may use Gemini activity to improve products; reviewers can read conversations.",
    },
    "copilot.microsoft.com": {
      name: "Copilot",
      editor: ["textarea#userInput", "textarea", "div[contenteditable='true']"],
      sendButton: ["button[aria-label*='Submit']", "button[aria-label*='Send']"],
      responseRoot: ["main", "div[role='main']"],
      note: "Microsoft may retain Copilot interactions; do not share government IDs or credentials.",
    },
    "bing.com": genericConfig(
      "Copilot",
      "Microsoft may retain Copilot interactions; do not share government IDs or credentials."
    ),
    "perplexity.ai": genericConfig(
      "Perplexity",
      "Perplexity may log and retain your queries; avoid sharing personal IDs or credentials."
    ),
    "poe.com": genericConfig("Poe", GENERIC_NOTE),
    "character.ai": genericConfig("Character.AI", GENERIC_NOTE),
    "mistral.ai": genericConfig("Mistral", GENERIC_NOTE),
    "chat.mistral.ai": genericConfig("Le Chat", GENERIC_NOTE),
    "groq.com": genericConfig("Groq", GENERIC_NOTE),
    "huggingface.co": genericConfig("HuggingChat", GENERIC_NOTE),
    "you.com": genericConfig("You.com", GENERIC_NOTE),
    "writesonic.com": genericConfig("Writesonic", GENERIC_NOTE),
    "jasper.ai": genericConfig("Jasper", GENERIC_NOTE),
    "copy.ai": genericConfig("Copy.ai", GENERIC_NOTE),
    "rytr.me": genericConfig("Rytr", GENERIC_NOTE),
    "notion.so": genericConfig("Notion AI", GENERIC_NOTE),
    "pi.ai": genericConfig("Pi", GENERIC_NOTE),
    "inflection.ai": genericConfig("Inflection", GENERIC_NOTE),
    "cohere.com": genericConfig("Cohere", GENERIC_NOTE),
    "playground.ai": genericConfig("Playground", GENERIC_NOTE),
    "phind.com": genericConfig("Phind", GENERIC_NOTE),
    "together.ai": genericConfig("Together", GENERIC_NOTE),
    "fireworks.ai": genericConfig("Fireworks", GENERIC_NOTE),
    "deepseek.com": genericConfig("DeepSeek", GENERIC_NOTE),
    "qwen.ai": genericConfig("Qwen", GENERIC_NOTE),
    "grok.com": genericConfig("Grok", GENERIC_NOTE),
    "x.com": genericConfig("Grok", GENERIC_NOTE),
    "meta.ai": genericConfig("Meta AI", GENERIC_NOTE),
    "llama.meta.com": genericConfig("Meta Llama", GENERIC_NOTE),
    "use.ai": genericConfig("Use.ai", GENERIC_NOTE),
  };

  function chatGPTConfig() {
    return {
      name: "ChatGPT",
      editor: ["div#prompt-textarea", "div[contenteditable='true']", "textarea#prompt-textarea", "textarea"],
      sendButton: ["button[data-testid='send-button']", "button[aria-label*='Send']"],
      responseRoot: ["main", "div[role='presentation']"],
      responseMessage: ['[data-message-author-role="assistant"]'],
      userMessage: ['[data-message-author-role="user"]'],
      note: "OpenAI may use chats to train models unless you opt out; treat anything you send as potentially retained.",
    };
  }

  /**
   * Resolve the config for the current host. We match the exact host first,
   * then fall back to a suffix match so subdomains (e.g. www.bing.com,
   * chat.deepseek.com) resolve to the registered domain's config.
   */
  function resolveConfig(host) {
    if (PLATFORMS[host]) return PLATFORMS[host];
    for (const domain in PLATFORMS) {
      if (host === domain || host.endsWith("." + domain)) return PLATFORMS[domain];
    }
    return null;
  }

  const HOST = location.hostname.replace(/^www\./, "");
  const CONFIG = resolveConfig(HOST);
  if (!CONFIG) return; // Not a supported site.

  /* ------------------------------------------------------------------ *
   * Shared instances + runtime state.
   * ------------------------------------------------------------------ */
  const detector = new Detector();
  const nlp = new NlpDetector();
  const masker = new Masker();

  const state = {
    enabled: true, // master on/off (synced from storage)
    maskingEnabled: false, // mask-before-send mode
    autoRestore: true, // auto-swap fakes -> real in AI responses (panel toggle)
    pendingSend: null, // {editor, text, resend} awaiting user choice
    warningEl: null, // the live warning popup element
    lastMaskedText: null, // the masked text we just typed in; lets the user's
    // own manual send pass through without re-scanning/re-masking.
  };

  /* ------------------------------------------------------------------ *
   * Storage sync — keep local state in step with the dashboard toggles.
   * ------------------------------------------------------------------ */
  async function loadSettings() {
    const data = await chrome.storage.local.get([
      "guardai_enabled",
      "guardai_masking_enabled",
      "guardai_auto_restore",
    ]);
    state.enabled = data.guardai_enabled !== false; // default ON
    state.maskingEnabled = data.guardai_masking_enabled === true; // default OFF
    state.autoRestore = data.guardai_auto_restore !== false; // default ON
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.guardai_enabled) state.enabled = changes.guardai_enabled.newValue !== false;
    if (changes.guardai_masking_enabled)
      state.maskingEnabled = changes.guardai_masking_enabled.newValue === true;
    if (changes.guardai_auto_restore) {
      state.autoRestore = changes.guardai_auto_restore.newValue !== false;
      syncAutoRestoreSwitch();
    }
  });

  /** Tell the background worker to record a stat event. */
  function reportStats(payload) {
    try {
      chrome.runtime.sendMessage({ type: "GUARDAI_STATS", platform: CONFIG.name, ...payload });
    } catch (_) {
      /* service worker asleep — non-fatal */
    }
  }

  /* ------------------------------------------------------------------ *
   * Editor read/write abstraction (textarea vs contenteditable).
   * ------------------------------------------------------------------ */
  function findEditor() {
    for (const sel of CONFIG.editor) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  /** Find the editor element that contains a given event target, if any. */
  function findEditorFor(node) {
    if (!node || typeof node.closest !== "function") return null;
    try {
      return node.closest(CONFIG.editor.join(","));
    } catch {
      return null;
    }
  }

  function getEditorText(el) {
    if (!el) return "";
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return el.value;
    return el.innerText || el.textContent || "";
  }

  /** Small async sleep helper. */
  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Whitespace-insensitive compare (rich editors normalise spacing/newlines). */
  function normalize(s) {
    return (s || "").replace(/\s+/g, " ").trim();
  }

  /**
   * Copy text to the clipboard. We prefer the async Clipboard API and fall
   * back to a hidden textarea + execCommand("copy") for older/locked-down
   * contexts. Best-effort: never throws.
   */
  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {
      /* permission denied or not focused — fall through */
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * Empty the editor without fighting its internal model: select all and delete
   * via execCommand, which every rich editor (ProseMirror/Lexical/Quill) and
   * plain textarea honours as a normal edit.
   */
  function clearEditor(el) {
    el.focus();
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      const proto =
        el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
      setter.call(el, "");
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
    try {
      document.execCommand("delete", false);
    } catch (_) {
      /* ignore */
    }
  }

  /** Collapse the caret to the very end of a contenteditable so the next
   * insertText appends rather than overwriting. */
  function caretToEnd(el) {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false); // false = collapse to end
    sel.removeAllRanges();
    sel.addRange(range);
  }

  /**
   * Insert a single character via the normal input pipeline.
   * For contenteditable we rely on execCommand("insertText"), which dispatches
   * the beforeinput/input pair editors expect from real typing. We do NOT
   * refocus per character — refocusing resets the selection in ProseMirror and
   * makes the insert silently no-op (the bug behind "retyped unchanged").
   */
  function insertChar(el, ch) {
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      const proto =
        el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
      setter.call(el, el.value + ch);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }
    try {
      return document.execCommand("insertText", false, ch);
    } catch (_) {
      return false;
    }
  }

  /**
   * Replace the editor contents with `text` by simulating typing. We clear,
   * place the caret, then type char-by-char. If the editor refuses programmatic
   * per-key inserts (some rich editors do), we fall back to a synthetic paste —
   * ProseMirror/Lexical/Quill all honour their clipboard handler — and finally
   * to a single execCommand insertText. Returns true once the editor really
   * shows the text, so the masked value can never silently fail to land.
   */
  async function typeText(el, text) {
    el.focus();
    clearEditor(el);
    await delay(20);

    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      for (const ch of text) {
        insertChar(el, ch);
        await delay(3);
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      if (normalize(getEditorText(el)).includes(normalize(text))) return true;
      // Fallback: native setter for the whole value.
      const proto =
        el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return normalize(getEditorText(el)).includes(normalize(text));
    }

    // contenteditable: type each character. We keep the caret at the end before
    // every keystroke — ProseMirror occasionally moves/normalises the selection
    // between programmatic inserts, and a stale selection makes the next
    // execCommand silently no-op (that left the phone/email un-typed before).
    // We do NOT break on a falsy return: some chars report false yet still
    // insert, and a hard verify + fallback below guarantees the full text lands.
    el.focus();
    caretToEnd(el);
    for (const ch of text) {
      caretToEnd(el);
      insertChar(el, ch);
      await delay(3);
    }
    el.dispatchEvent(new InputEvent("input", { bubbles: true }));
    if (normalize(getEditorText(el)).includes(normalize(text))) return true;

    // Char-by-char didn't fully land — replace everything reliably.
    return replaceAll(el, text);
  }

  /**
   * Reliable whole-string replace for contenteditable. A single
   * execCommand("insertText") over a full selection is honoured by ProseMirror,
   * Lexical and Quill. A synthetic paste is tried only as a final fallback —
   * Chrome forbids setting real clipboardData on synthetic events, so it's
   * unreliable and must never be the primary path.
   */
  function replaceAll(el, text) {
    const selectAll = () => {
      el.focus();
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
    };

    // Primary: select all + single insertText.
    selectAll();
    try {
      document.execCommand("insertText", false, text);
    } catch (_) {
      /* fall through */
    }
    if (normalize(getEditorText(el)).includes(normalize(text))) return Promise.resolve(true);

    // Final fallback: synthetic paste, then re-verify.
    selectAll();
    try {
      const dt = new DataTransfer();
      dt.setData("text/plain", text);
      el.dispatchEvent(
        new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })
      );
    } catch (_) {
      /* DataTransfer/ClipboardEvent unavailable */
    }
    return new Promise((resolve) => {
      setTimeout(() => resolve(normalize(getEditorText(el)).includes(normalize(text))), 80);
    });
  }

  /* ------------------------------------------------------------------ *
   * Detection — combine pattern engine with the optional NLP layer.
   * ------------------------------------------------------------------ */
  async function scanText(text) {
    const findings = detector.scan(text);
    if (nlp.isAvailable()) {
      try {
        const nlpFindings = await nlp.scan(text);
        // Merge, dropping NLP hits that overlap an existing pattern finding.
        for (const nf of nlpFindings) {
          const overlaps = findings.some(
            (f) => nf.index < f.index + f.value.length && nf.index + nf.value.length > f.index
          );
          if (!overlaps) findings.push(nf);
        }
        findings.sort((a, b) => a.index - b.index);
      } catch (_) {
        /* ignore NLP errors, patterns already ran */
      }
    }
    return findings;
  }

  /* ------------------------------------------------------------------ *
   * Mask + type (NO auto-send). Shared by masking-mode and the warning
   * popup's "Mask & type" button.
   *
   * Philosophy: never fight the site's editor and never auto-send. We:
   *   1. compute the masked text,
   *   2. clear the editor and type the masked text in (every editor accepts
   *      typing; a reliable whole-string fallback guarantees it fully lands),
   *   3. copy the masked text to the clipboard AFTER typing — the clipboard
   *      fallback uses a temp textarea that steals focus, so doing it first
   *      would break the typing into the real editor,
   *   4. STOP — the user reviews and presses send themselves.
   * The matching fake->real swap happens automatically in the AI response.
   * ------------------------------------------------------------------ */
  async function maskAndType(editor, text, findings) {
    const { masked, replacements } = await masker.mask(text, findings);

    // Type it in first, simulating a human. If typing didn't land, flag it.
    const ok = await typeText(editor, masked);

    // Now copy the masked text to the clipboard (after typing, so its focus
    // handling can't disturb the editor write).
    await copyToClipboard(masked);

    // Remember what we typed so the user's own send isn't re-scanned/re-masked.
    state.lastMaskedText = masked;

    if (!ok) {
      logActivity("mask", replacements);
      return;
    }

    logActivity("mask", replacements);
    reportStats({ masked: replacements.length });
    editor.focus();
  }

  /**
   * Trigger the platform's send action robustly: poll for an enabled send
   * button (up to ~1.5s) and click it; only fall back to a synthetic Enter if
   * no usable button appears.
   */
  function triggerSend(editor) {
    let tries = 0;
    const MAX = 30; // ~1.5s at 50ms
    const attempt = () => {
      tries++;
      const btn = findEnabledSendButton();
      if (btn) {
        bypassNext = true; // let our own click pass through the interceptor
        btn.click();
        return;
      }
      if (tries < MAX) {
        setTimeout(attempt, 50);
        return;
      }
      // Fallback: synthetic Enter on the editor.
      bypassNext = true;
      editor.focus();
      editor.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
        })
      );
    };
    attempt();
  }

  /** Find a send button that is present and not disabled. */
  function findEnabledSendButton() {
    for (const sel of CONFIG.sendButton) {
      const btn = document.querySelector(sel);
      if (
        btn &&
        !btn.disabled &&
        btn.getAttribute("aria-disabled") !== "true" &&
        btn.offsetParent !== null // visible
      ) {
        return btn;
      }
    }
    return null;
  }

  /** Passwords/secrets must never be shown back to the user in plain text. */
  function displayReal(rep) {
    return rep.type === "PASSWORD" ? "\u2022\u2022\u2022\u2022\u2022\u2022" : rep.real;
  }

  /* ------------------------------------------------------------------ *
   * Persistent activity panel (right side).
   * Logs every mask applied before sending (real -> fake) and every value
   * restored in a response (fake -> real). It stays open until the user
   * clicks X, then collapses to a small floating badge that reopens it.
   * Entries persist across reloads in chrome.storage.local so the running
   * log survives navigation within the conversation.
   * ------------------------------------------------------------------ */
  const ACTIVITY_KEY = "guardai_activity";
  const ACTIVITY_CAP = 200; // keep the log bounded
  let activityLog = []; // [{id, kind:"mask"|"unmask"|"pending", type, fake, real, revealed, at}]
  let activitySeq = 1; // monotonic id for entries (lets Reveal target one row)
  const loggedKeys = new Set(); // dedupe so re-renders don't double-log
  let panelEl = null;
  let panelListEl = null;
  let reopenEl = null;
  let panelClosed = false; // user explicitly closed the panel this session

  async function loadActivity() {
    try {
      const data = await chrome.storage.local.get([ACTIVITY_KEY]);
      activityLog = Array.isArray(data[ACTIVITY_KEY]) ? data[ACTIVITY_KEY] : [];
    } catch {
      activityLog = [];
    }
    for (const it of activityLog) {
      loggedKeys.add(it.kind + "|" + it.fake + "|" + it.real);
      if (typeof it.id === "number" && it.id >= activitySeq) activitySeq = it.id + 1;
    }
  }

  function persistActivity() {
    if (activityLog.length > ACTIVITY_CAP) activityLog = activityLog.slice(-ACTIVITY_CAP);
    try {
      chrome.storage.local.set({ [ACTIVITY_KEY]: activityLog });
    } catch {
      /* storage may be unavailable; the in-memory log still works */
    }
  }

  /**
   * Append swaps to the running log and refresh the panel. `kind` is "mask"
   * (real -> fake, before send) or "unmask" (fake -> real, in a response).
   * Passwords are stored and shown as bullets, never in clear.
   */
  function logActivity(kind, items) {
    if (!items || !items.length) return;
    let added = 0;
    for (const it of items) {
      const real = it.type === "PASSWORD" ? "\u2022\u2022\u2022\u2022\u2022\u2022" : it.real;
      const key = kind + "|" + it.fake + "|" + real;
      if (loggedKeys.has(key)) continue; // skip duplicates / re-render echoes
      loggedKeys.add(key);
      activityLog.push({
        id: activitySeq++,
        kind,
        type: it.type,
        fake: it.fake,
        real,
        revealed: false,
        at: Date.now(),
      });
      added++;
    }
    if (!added) return;
    persistActivity();
    if (!panelClosed) {
      ensurePanel();
      renderPanel();
    } else {
      showReopen(); // keep the badge count current while collapsed
    }
  }

  function ensurePanel() {
    if (panelEl) {
      panelEl.style.display = "";
      if (reopenEl) reopenEl.style.display = "none";
      return;
    }
    panelEl = document.createElement("div");
    panelEl.className = "guardai-panel";
    panelEl.innerHTML =
      `<div class="guardai-panel__header">` +
      `<span class="guardai-panel__shield">&#128737;</span>` +
      `<span class="guardai-panel__title">GuardAI activity</span>` +
      `<button class="guardai-panel__close" title="Close" aria-label="Close">&times;</button>` +
      `</div>` +
      `<div class="guardai-panel__sub">Real data stays on this device. Only masked values are sent to the AI.</div>` +
      `<div class="guardai-panel__toggle">` +
      `<div class="guardai-panel__toggletext">` +
      `<span class="guardai-panel__togglelabel">Auto-restore</span>` +
      `<span class="guardai-panel__togglehint"></span>` +
      `</div>` +
      `<button class="guardai-panel__switch" role="switch"></button>` +
      `</div>` +
      `<div class="guardai-panel__actions">` +
      `<button class="guardai-panel__action" data-act="clear-log">Clear all</button>` +
      `<button class="guardai-panel__action guardai-panel__action--danger" data-act="clear-session">Clear session</button>` +
      `</div>` +
      `<div class="guardai-panel__list"></div>`;
    document.body.appendChild(panelEl);
    panelListEl = panelEl.querySelector(".guardai-panel__list");
    panelEl.querySelector(".guardai-panel__close").onclick = closePanel;
    panelEl.querySelector(".guardai-panel__switch").onclick = () =>
      setAutoRestore(!state.autoRestore);
    panelEl.querySelector('[data-act="clear-log"]').onclick = clearActivityLog;
    panelEl.querySelector('[data-act="clear-session"]').onclick = clearSession;
    // Delegate "Reveal real data" clicks for pending rows.
    panelListEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".guardai-panel__reveal");
      if (!btn) return;
      const id = Number(btn.getAttribute("data-id"));
      const entry = activityLog.find((x) => x.id === id);
      if (entry) {
        entry.revealed = true;
        persistActivity();
        renderPanel();
      }
    });
    syncAutoRestoreSwitch();
  }

  /** Reflect state.autoRestore on the panel switch (if the panel exists). */
  function syncAutoRestoreSwitch() {
    if (!panelEl) return;
    const sw = panelEl.querySelector(".guardai-panel__switch");
    const hint = panelEl.querySelector(".guardai-panel__togglehint");
    if (sw) {
      sw.setAttribute("aria-checked", state.autoRestore ? "true" : "false");
      sw.classList.toggle("guardai-panel__switch--on", state.autoRestore);
    }
    if (hint) {
      hint.textContent = state.autoRestore
        ? "Responses are swapped back to your real data automatically."
        : "Responses stay masked — click Reveal to see your real data here.";
    }
  }

  /** Toggle auto-restore, persist it, and re-run a pass to apply the change. */
  function setAutoRestore(on) {
    state.autoRestore = on;
    try {
      chrome.storage.local.set({ guardai_auto_restore: on });
    } catch {
      /* non-fatal */
    }
    syncAutoRestoreSwitch();
    // Move unpinned messages to the new default view, then re-run a pass so the
    // change is reflected on screen immediately.
    syncMessageViewsToDefault();
    announcedSwaps.clear();
    scheduleUnmask();
  }

  /** Clear the visible activity log only (mapping stays, so restores keep working). */
  function clearActivityLog() {
    activityLog = [];
    loggedKeys.clear();
    announcedSwaps.clear();
    try {
      chrome.storage.local.set({ [ACTIVITY_KEY]: [] });
    } catch {
      /* non-fatal */
    }
    renderPanel();
    if (reopenEl) reopenEl.querySelector(".guardai-reopen__count").textContent = "0";
  }

  /** Full reset: wipe the fake<->real mapping AND the log so the user starts fresh. */
  function clearSession() {
    masker.clear(); // drops the mapping + its storage key
    activityLog = [];
    loggedKeys.clear();
    announcedSwaps.clear();
    state.lastMaskedText = null;
    try {
      chrome.storage.local.set({ [ACTIVITY_KEY]: [] });
    } catch {
      /* non-fatal */
    }
    renderPanel();
    if (reopenEl) reopenEl.querySelector(".guardai-reopen__count").textContent = "0";
  }

  function closePanel() {
    panelClosed = true;
    if (panelEl) panelEl.style.display = "none";
    showReopen();
  }

  function showReopen() {
    if (!reopenEl) {
      reopenEl = document.createElement("button");
      reopenEl.className = "guardai-reopen";
      reopenEl.setAttribute("aria-label", "Open GuardAI activity");
      reopenEl.innerHTML =
        `<span class="guardai-reopen__shield">&#128737;</span>` +
        `<span class="guardai-reopen__count"></span>`;
      reopenEl.onclick = () => {
        panelClosed = false;
        reopenEl.style.display = "none";
        ensurePanel();
        renderPanel();
      };
      document.body.appendChild(reopenEl);
    }
    reopenEl.querySelector(".guardai-reopen__count").textContent = String(activityLog.length);
    reopenEl.style.display = "";
  }

  function renderPanel() {
    if (!panelListEl) return;
    if (!activityLog.length) {
      panelListEl.innerHTML =
        `<div class="guardai-panel__empty">No activity yet. When you mask data or ` +
        `GuardAI restores a response, it appears here.</div>`;
      return;
    }
    // Newest first, capped to the most recent 20 so the log never stacks endlessly.
    panelListEl.innerHTML = activityLog
      .slice(-20)
      .reverse()
      .map((it) => {
        // Pending = auto-restore is off; the response still shows the fake and
        // the user reveals the real value here, on demand, per item.
        if (it.kind === "pending" && !it.revealed) {
          return (
            `<div class="guardai-panel__row guardai-panel__row--pending">` +
            `<div class="guardai-panel__rowhead">` +
            `<span class="guardai-panel__tag">In response</span>` +
            `<span class="guardai-panel__type">${escapeHtml(it.type || "")}</span>` +
            `</div>` +
            `<div class="guardai-panel__swap">` +
            `<span class="guardai-panel__from guardai-panel__from--fake">${escapeHtml(it.fake)}</span>` +
            `</div>` +
            `<button class="guardai-panel__reveal" data-id="${it.id}">Reveal real data</button>` +
            `</div>`
          );
        }

        const isMask = it.kind === "mask";
        const from = isMask ? it.real : it.fake;
        const to = isMask ? it.fake : it.real;
        const tag = isMask ? "Masked" : it.kind === "pending" ? "Revealed" : "Restored";
        const cls = isMask
          ? "guardai-panel__row--mask"
          : "guardai-panel__row--unmask";
        return (
          `<div class="guardai-panel__row ${cls}">` +
          `<div class="guardai-panel__rowhead">` +
          `<span class="guardai-panel__tag">${tag}</span>` +
          `<span class="guardai-panel__type">${escapeHtml(it.type || "")}</span>` +
          `</div>` +
          `<div class="guardai-panel__swap">` +
          `<span class="guardai-panel__from">${escapeHtml(from)}</span>` +
          `<span class="guardai-panel__arrow">&rarr;</span>` +
          `<span class="guardai-panel__to">${escapeHtml(to)}</span>` +
          `</div>` +
          `</div>`
        );
      })
      .join("");
    if (reopenEl) reopenEl.querySelector(".guardai-reopen__count").textContent = String(activityLog.length);
  }

  /* ------------------------------------------------------------------ *
   * Send interception.
   * We intercept BOTH the Enter key and clicks on the send button, in the
   * capture phase, so we run before the site's own handlers. If we decide to
   * block, we stopImmediatePropagation + preventDefault, then later re-trigger
   * the original send programmatically once the user has chosen.
   * ------------------------------------------------------------------ */

  let bypassNext = false; // set true to allow the very next send through untouched

  async function handleSendAttempt(editor, originalResend) {
    if (!state.enabled) return true; // extension off -> allow

    const text = getEditorText(editor).trim();
    if (!text) return true;

    // If this is the exact masked text we just typed in, the user is sending
    // it themselves — let it through untouched (don't re-scan/re-mask).
    if (state.lastMaskedText && normalize(text) === normalize(state.lastMaskedText)) {
      state.lastMaskedText = null;
      return true;
    }

    const findings = await scanText(text);

    // Nothing sensitive -> let it fly.
    if (!findings.length) return true;

    reportStats({ detected: findings.length });

    if (state.maskingEnabled) {
      // Masking mode: mask + type the fakes in place, then STOP. The user
      // reviews the masked text and presses send themselves.
      await maskAndType(editor, text, findings);
      return false; // we typed; nothing to send automatically
    }

    // Review mode: show the full-screen pre-send preview and wait for a choice.
    showPreSendPreview(editor, text, findings, originalResend);
    return false; // block until user decides
  }

  /** Programmatically trigger the site's send (Enter on the editor). */
  function makeResender(editor) {
    // Route through the same robust sender used after masking, so it waits for
    // an enabled send button before clicking (with a synthetic-Enter fallback).
    return function resend() {
      triggerSend(editor);
    };
  }

  // ---- Enter key interception (capture phase) ----
  document.addEventListener(
    "keydown",
    async (e) => {
      if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
      // Resolve the editor the user is actually typing in (not just the first
      // match on the page) so multi-editor / re-rendered layouts still intercept.
      const editor = findEditorFor(e.target) || findEditor();
      if (!editor || !isWithin(e.target, editor)) return;

      if (bypassNext) {
        bypassNext = false;
        return; // this is our own re-send, let it pass
      }

      // Hold the event while we scan asynchronously.
      e.preventDefault();
      e.stopImmediatePropagation();

      const allow = await handleSendAttempt(editor, makeResender(editor));
      if (allow) {
        bypassNext = true;
        makeResender(editor)();
      }
    },
    true
  );

  // ---- Send-button interception (capture phase) ----
  document.addEventListener(
    "click",
    async (e) => {
      const btn = e.target.closest(CONFIG.sendButton.join(","));
      if (!btn) return;

      if (bypassNext) {
        bypassNext = false;
        return;
      }

      const editor = findEditor();
      if (!editor) return;

      e.preventDefault();
      e.stopImmediatePropagation();

      const allow = await handleSendAttempt(editor, makeResender(editor));
      if (allow) {
        bypassNext = true;
        makeResender(editor)();
      }
    },
    true
  );

  function isWithin(node, container) {
    return node === container || container.contains(node);
  }

  /* ------------------------------------------------------------------ *
   * Warning popup — non-blocking, positioned above the input field.
   * ------------------------------------------------------------------ */
  function showWarning(editor, text, findings, resend) {
    dismissWarning();

    // Group findings by type for a clean summary.
    const groups = {};
    for (const f of findings) {
      (groups[f.type] = groups[f.type] || { label: f.label, reason: f.reason, items: [] }).items.push(
        f.value
      );
    }

    const wrap = document.createElement("div");
    wrap.className = "guardai-warning";
    wrap.setAttribute("role", "alertdialog");
    wrap.setAttribute("aria-live", "polite");

    const header = document.createElement("div");
    header.className = "guardai-warning__header";
    header.innerHTML = `
      <span class="guardai-warning__shield">&#128737;</span>
      <span class="guardai-warning__title">GuardAI detected sensitive data</span>
      <button class="guardai-warning__close" aria-label="Dismiss">&times;</button>
    `;

    const body = document.createElement("div");
    body.className = "guardai-warning__body";

    const platformNote = document.createElement("p");
    platformNote.className = "guardai-warning__platform";
    platformNote.textContent = `Sending to ${CONFIG.name}: ${CONFIG.note}`;
    body.appendChild(platformNote);

    const list = document.createElement("ul");
    list.className = "guardai-warning__list";
    for (const key in groups) {
      const g = groups[key];
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="guardai-warning__type">${escapeHtml(g.label)}</span>
        <span class="guardai-warning__count">${g.items.length}</span>
        <p class="guardai-warning__reason">${escapeHtml(g.reason)}</p>
      `;
      list.appendChild(li);
    }
    body.appendChild(list);

    const actions = document.createElement("div");
    actions.className = "guardai-warning__actions";
    actions.innerHTML = `
      <button class="guardai-btn guardai-btn--mask">Mask &amp; type</button>
      <button class="guardai-btn guardai-btn--send">Send anyway</button>
      <button class="guardai-btn guardai-btn--cancel">Cancel</button>
    `;

    wrap.appendChild(header);
    wrap.appendChild(body);
    wrap.appendChild(actions);
    document.body.appendChild(wrap);
    state.warningEl = wrap;

    positionAbove(wrap, editor);
    // Reposition if the layout shifts while the popup is open.
    const reposition = () => positionAbove(wrap, editor);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    wrap._cleanup = () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };

    // --- wire up buttons ---
    header.querySelector(".guardai-warning__close").onclick = dismissWarning;
    actions.querySelector(".guardai-btn--cancel").onclick = () => {
      dismissWarning();
      editor.focus();
    };
    actions.querySelector(".guardai-btn--send").onclick = () => {
      dismissWarning();
      reportStats({ sentUnmasked: 1 });
      resend();
    };
    actions.querySelector(".guardai-btn--mask").onclick = async () => {
      dismissWarning();
      await maskAndType(editor, text, findings);
    };
  }

  function positionAbove(el, editor) {
    const r = editor.getBoundingClientRect();
    const margin = 12;
    const width = Math.min(420, window.innerWidth - 24);
    el.style.width = width + "px";
    let left = r.left + r.width / 2 - width / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    el.style.left = left + "px";
    // Place above the editor; if not enough room, drop below it.
    const elHeight = el.offsetHeight || 220;
    let top = r.top - elHeight - margin;
    if (top < 12) top = r.bottom + margin;
    el.style.top = top + "px";
  }

  function dismissWarning() {
    if (state.warningEl) {
      if (state.warningEl._cleanup) state.warningEl._cleanup();
      state.warningEl.remove();
      state.warningEl = null;
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /* ------------------------------------------------------------------ *
   * Pre-send review preview.
   * When sensitive data is detected on send, we show a full-screen overlay that
   * displays the exact message, highlights every detected item in a per-type
   * colour, and lets the user mask anything the detector missed by selecting it.
   * "Send masked" swaps every highlighted item for its fake and sends; "Cancel"
   * leaves the original message untouched in the editor. Nothing is sent until
   * the user chooses. Detection, masking and auto-restore are all reused as-is.
   * ------------------------------------------------------------------ */
  const PV_STYLE = {
    NAME_PII: { label: "Name", color: "#58a6ff" },
    PHONE: { label: "Phone", color: "#f0883e" },
    EMAIL: { label: "Email", color: "#3fb950" },
    ADDRESS: { label: "Address", color: "#bc8cff" },
    DOB: { label: "Date of birth", color: "#e3b341" },
    PASSPORT: { label: "Passport", color: "#e3b341" },
    LICENCE: { label: "Licence", color: "#e3b341" },
    MEDICARE: { label: "Medicare", color: "#e3b341" },
    TFN: { label: "TFN", color: "#e3b341" },
    CREDIT_CARD: { label: "Card number", color: "#e3b341" },
    BSB: { label: "BSB", color: "#e3b341" },
    BANK_ACCOUNT: { label: "Bank account", color: "#e3b341" },
    MONEY: { label: "Amount", color: "#e3b341" },
    GPS: { label: "GPS", color: "#e3b341" },
    ABN: { label: "ABN", color: "#e3b341" },
    ACN: { label: "ACN", color: "#e3b341" },
    PASSWORD: { label: "Password", color: "#f85149" },
  };
  const PV_DEFAULT = { label: "Sensitive", color: "#e3b341" };
  const PV_MANUAL = { label: "Manual", color: "#ff7b9c" };

  let pv = null; // active preview state (null when closed)

  function pvStyle(type, manual) {
    return PV_STYLE[type] || (manual ? PV_MANUAL : PV_DEFAULT);
  }

  /** Get (memoised) the proposed fake for a real value so duplicates align. */
  function pvFakeFor(type, value) {
    if (pv.fakeByReal.has(value)) return pv.fakeByReal.get(value);
    const f = masker.previewFake(type, value);
    pv.fakeByReal.set(value, f);
    return f;
  }

  async function showPreSendPreview(editor, original, findings, resend) {
    if (pv) pvClose();
    await masker.load();

    pv = {
      editor,
      original,
      resend,
      items: [],
      fakeByReal: new Map(),
      pendingSel: null,
      popEl: null,
      onKey: null,
    };

    // Seed with the maskable auto-detected findings (detector already resolves
    // overlaps). Warning-only findings can still be masked manually.
    for (const f of findings) {
      if (!masker.isMaskable(f.type)) continue;
      pv.items.push({
        start: f.index,
        end: f.index + f.value.length,
        value: f.value,
        type: f.type,
        manual: false,
        fake: pvFakeFor(f.type, f.value),
      });
    }
    pv.items.sort((a, b) => a.start - b.start);

    const overlay = document.createElement("div");
    overlay.className = "guardai-pv";
    overlay.innerHTML =
      `<div class="guardai-pv__card" role="dialog" aria-label="GuardAI pre-send review">` +
      `<div class="guardai-pv__head">` +
      `<span class="guardai-pv__shield">&#128737;</span>` +
      `<span class="guardai-pv__count"></span>` +
      `<button class="guardai-pv__x" aria-label="Cancel">&times;</button>` +
      `</div>` +
      `<div class="guardai-pv__hint">Review what you're sending to ${escapeHtml(CONFIG.name)}. ` +
      `Highlighted items are replaced with realistic fakes. Select any missed text to mask it too.</div>` +
      `<div class="guardai-pv__legend"></div>` +
      `<div class="guardai-pv__body" tabindex="0"></div>` +
      `<div class="guardai-pv__foot">` +
      `<button class="guardai-pv__btn guardai-pv__btn--cancel">Cancel</button>` +
      `<button class="guardai-pv__btn guardai-pv__btn--send">Send masked</button>` +
      `</div>` +
      `</div>`;
    document.body.appendChild(overlay);

    pv.el = overlay;
    pv.bodyEl = overlay.querySelector(".guardai-pv__body");
    pv.countEl = overlay.querySelector(".guardai-pv__count");
    pv.legendEl = overlay.querySelector(".guardai-pv__legend");

    overlay.querySelector(".guardai-pv__x").onclick = pvCancel;
    overlay.querySelector(".guardai-pv__btn--cancel").onclick = pvCancel;
    overlay.querySelector(".guardai-pv__btn--send").onclick = pvSendMasked;
    pv.bodyEl.addEventListener("mouseup", pvHandleSelection);

    // Escape cancels; keep it scoped to while the overlay is open.
    pv.onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        pvCancel();
      }
    };
    document.addEventListener("keydown", pv.onKey, true);

    pvRenderBody();
    pvRenderMeta();
    // Move focus off the site editor so a stray Enter can't re-trigger send.
    pv.bodyEl.focus();
  }

  /** Render the message with each item wrapped in a coloured mark. */
  function pvRenderBody() {
    const items = pv.items.slice().sort((a, b) => a.start - b.start);
    const out = [];
    let cursor = 0;
    for (const it of items) {
      if (it.start > cursor) {
        out.push(
          `<span class="guardai-pv-seg" data-start="${cursor}">` +
            escapeHtml(pv.original.slice(cursor, it.start)) +
            `</span>`
        );
      }
      const st = pvStyle(it.type, it.manual);
      const shown = it.type === "PASSWORD" ? "\u2022\u2022\u2022\u2022\u2022\u2022" : it.value;
      out.push(
        `<mark class="guardai-pv-mark" data-start="${it.start}" data-type="${escapeHtml(it.type)}" ` +
          `style="--pv:${st.color}">` +
          escapeHtml(shown) +
          `</mark>`
      );
      cursor = it.end;
    }
    if (cursor < pv.original.length) {
      out.push(
        `<span class="guardai-pv-seg" data-start="${cursor}">` +
          escapeHtml(pv.original.slice(cursor)) +
          `</span>`
      );
    }
    pv.bodyEl.innerHTML = out.join("");
  }

  /** Update the "N items masked" count and the colour legend. */
  function pvRenderMeta() {
    const n = pv.items.length;
    pv.countEl.textContent = n === 1 ? "1 item masked" : `${n} items masked`;
    const seen = new Map();
    for (const it of pv.items) {
      const st = pvStyle(it.type, it.manual);
      if (!seen.has(st.label)) seen.set(st.label, st.color);
    }
    pv.legendEl.innerHTML = Array.from(seen.entries())
      .map(
        ([label, color]) =>
          `<span class="guardai-pv-legend__item">` +
          `<span class="guardai-pv-dot" style="background:${color}"></span>` +
          escapeHtml(label) +
          `</span>`
      )
      .join("");
  }

  /** Map a selection boundary (node + offset) to an index in the original text. */
  function pvOffset(node, offsetInNode) {
    let span = node && node.nodeType === 3 ? node.parentElement : node;
    while (span && span !== pv.bodyEl && !(span.getAttribute && span.hasAttribute("data-start"))) {
      span = span.parentElement;
    }
    if (!span || !span.getAttribute || !span.hasAttribute("data-start")) return null;
    const base = Number(span.getAttribute("data-start"));
    if (node.nodeType === 3) return base + offsetInNode;
    return offsetInNode > 0 ? base + span.textContent.length : base;
  }

  /** On a selection inside the message, offer to mask the highlighted text. */
  function pvHandleSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return pvHidePopup();
    const range = sel.getRangeAt(0);
    if (!pv.bodyEl.contains(range.commonAncestorContainer)) return pvHidePopup();
    let s = pvOffset(range.startContainer, range.startOffset);
    let e = pvOffset(range.endContainer, range.endOffset);
    if (s == null || e == null) return pvHidePopup();
    if (s > e) [s, e] = [e, s];
    while (s < e && /\s/.test(pv.original[s])) s++;
    while (e > s && /\s/.test(pv.original[e - 1])) e--;
    if (e - s < 1) return pvHidePopup();
    // Don't let a selection overlap an item that's already masked.
    if (pv.items.some((it) => !(e <= it.start || s >= it.end))) return pvHidePopup();
    pv.pendingSel = { start: s, end: e };
    pvShowPopup(range.getBoundingClientRect());
  }

  function pvShowPopup(rect) {
    pvHidePopup();
    const pop = document.createElement("div");
    pop.className = "guardai-pv-pop";
    pop.innerHTML =
      `<button class="guardai-pv-pop__btn" data-act="auto">Auto-replace</button>` +
      `<button class="guardai-pv-pop__btn" data-act="custom">Custom replace</button>`;
    document.body.appendChild(pop);
    pv.popEl = pop;

    pop.querySelector('[data-act="auto"]').onclick = pvAutoReplace;
    pop.querySelector('[data-act="custom"]').onclick = pvCustomReplaceUI;

    // Position above the selection, clamped to the viewport.
    const w = pop.offsetWidth || 220;
    let left = rect.left + rect.width / 2 - w / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = rect.top - (pop.offsetHeight || 40) - 8;
    if (top < 8) top = rect.bottom + 8;
    pop.style.left = left + "px";
    pop.style.top = top + "px";
  }

  function pvHidePopup() {
    if (pv && pv.popEl) {
      pv.popEl.remove();
      pv.popEl = null;
    }
  }

  /** Commit a manual mask: add the item, refresh, clear the selection. */
  function pvCommitManual(fake, type) {
    if (!pv.pendingSel) return;
    const { start, end } = pv.pendingSel;
    const value = pv.original.slice(start, end);
    pv.fakeByReal.set(value, fake);
    pv.items.push({ start, end, value, type: type || "MANUAL", manual: true, fake });
    pv.items.sort((a, b) => a.start - b.start);
    pv.pendingSel = null;
    pvHidePopup();
    const sel = window.getSelection();
    if (sel) sel.removeAllRanges();
    pvRenderBody();
    pvRenderMeta();
  }

  function pvAutoReplace() {
    const { start, end } = pv.pendingSel;
    const value = pv.original.slice(start, end);
    let type = "NAME_PII"; // a realistic AU name is the generic fallback
    try {
      const fs = detector.scan(value);
      const whole = fs.find((f) => masker.isMaskable(f.type) && f.value.trim() === value.trim());
      const any = whole || fs.find((f) => masker.isMaskable(f.type));
      if (any) type = any.type;
    } catch {
      /* fall back to NAME_PII */
    }
    pvCommitManual(pvFakeFor(type, value), type);
  }

  /** Swap the popup for a small input so the user can type their own fake. */
  function pvCustomReplaceUI() {
    if (!pv.popEl) return;
    pv.popEl.innerHTML =
      `<input class="guardai-pv-pop__input" type="text" placeholder="Your replacement" />` +
      `<button class="guardai-pv-pop__btn guardai-pv-pop__go" data-act="go">Mask</button>`;
    const input = pv.popEl.querySelector(".guardai-pv-pop__input");
    const commit = () => {
      const v = input.value.trim();
      if (v) pvCommitManual(v, "CUSTOM");
    };
    pv.popEl.querySelector('[data-act="go"]').onclick = commit;
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        pvHidePopup();
      }
    });
    input.focus();
  }

  /** Build the fully masked message, send it, and log every replacement. */
  async function pvSendMasked() {
    const { editor, original, resend } = pv;
    const items = pv.items.slice().sort((a, b) => a.start - b.start);

    for (const it of items) masker.registerManual(it.value, it.fake, it.type);
    await masker.save();

    let masked = original;
    const replacements = [];
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (masked.slice(it.start, it.end) === it.value) {
        masked = masked.slice(0, it.start) + it.fake + masked.slice(it.end);
      } else {
        masked = masked.split(it.value).join(it.fake);
      }
      replacements.push({ type: it.type, real: it.value, fake: it.fake });
    }

    pvClose();

    await typeText(editor, masked);
    await copyToClipboard(masked);
    state.lastMaskedText = masked;
    if (replacements.length) {
      logActivity("mask", replacements);
      reportStats({ masked: replacements.length });
    }
    editor.focus();
    resend(); // send the masked message
  }

  function pvCancel() {
    const editor = pv && pv.editor;
    pvClose();
    if (editor) editor.focus();
  }

  function pvClose() {
    if (!pv) return;
    pvHidePopup();
    if (pv.onKey) document.removeEventListener("keydown", pv.onKey, true);
    if (pv.el) pv.el.remove();
    pv = null;
  }

  /* ------------------------------------------------------------------ *
   * Auto-decryption — watch responses and swap fakes back to real values.
   * We debounce mutations and only rewrite text nodes that actually contain
   * a known fake, to keep things cheap and avoid clobbering the DOM.
   * ------------------------------------------------------------------ */
  let unmaskTimer = null;
  let lastUnmaskRun = 0;
  const UNMASK_DEBOUNCE = 180; // settle time after the last mutation
  const UNMASK_MAX_WAIT = 600; // but never wait longer than this while streaming
  // Fakes we've already announced, so React re-renders (which re-fire the
  // observer) don't spam the same "restored" message repeatedly.
  const announcedSwaps = new Set();

  /**
   * Schedule an unmask pass. Debounced so we don't thrash on every keystroke of
   * a streaming response, but with a hard ceiling (UNMASK_MAX_WAIT) so that a
   * long, continuous stream still gets restored periodically rather than only
   * after it finally stops. This is what keeps auto-restore firing on every new
   * response as it arrives.
   */
  function scheduleUnmask() {
    if (masker.size === 0) return; // nothing to swap back
    const now = Date.now();
    clearTimeout(unmaskTimer);
    const sinceLast = now - lastUnmaskRun;
    if (sinceLast >= UNMASK_MAX_WAIT) {
      lastUnmaskRun = now;
      runUnmaskPass();
      return;
    }
    const wait = Math.min(UNMASK_DEBOUNCE, UNMASK_MAX_WAIT - sinceLast);
    unmaskTimer = setTimeout(() => {
      lastUnmaskRun = Date.now();
      runUnmaskPass();
    }, wait);
  }

  /** Escape a string for safe use inside a RegExp. */
  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Build word-boundary-safe replacement rules from the mapping, longest match
   * first. Direction "unmask" swaps fake -> real (read the response in your real
   * data); "remask" swaps real -> fake (see exactly what the AI actually has).
   * For NAME_PII we also emit per-token aliases so a first-name-only echo from
   * the AI ("Hi Liam") still maps ("Hi John"). Word boundaries (no adjacent
   * letter/digit) stop short tokens like "Liam" matching inside words.
   */
  function buildSwapRules(direction) {
    const toReal = direction === "unmask";
    const raw = [];
    for (const [, entry] of masker.fakeToReal) {
      const from = toReal ? entry.fake : entry.real;
      const to = toReal ? entry.real : entry.fake;
      raw.push({ key: from, from, to, entry });
      if (entry.type === "NAME_PII" && /\s/.test(entry.fake) && /\s/.test(entry.real)) {
        const fromParts = from.split(/\s+/);
        const toParts = to.split(/\s+/);
        if (fromParts.length === toParts.length) {
          for (let i = 0; i < fromParts.length; i++) {
            if (fromParts[i].length >= 2) {
              raw.push({ key: fromParts[i], from: fromParts[i], to: toParts[i], entry });
            }
          }
        }
      }
    }
    // Longest "from" first so "Liam Brown" is handled before the "Liam" alias.
    raw.sort((a, b) => b.from.length - a.from.length);
    return raw.map((r) => {
      // Join the words of a multi-word value (e.g. an address) with a flexible
      // separator so the AI's reformatting still matches: extra spaces, an
      // inserted comma ("147 Banksia Street, Melbourne"), or a line break when
      // the value is wrapped across lines all count as a gap.
      const tokens = r.from.split(/\s+/).filter(Boolean).map(escapeRegExp);
      const multi = tokens.length > 1;
      const body = tokens.join("[\\s,]+");
      return {
        key: r.key,
        to: r.to,
        entry: r.entry,
        multi,
        re: new RegExp("(?<![A-Za-z0-9])" + body + "(?![A-Za-z0-9])", "g"),
      };
    });
  }

  /** Should this text node be left alone? (our UI, the live input editor). */
  function isProtectedNode(node, editor) {
    const p = node.parentElement;
    if (
      p &&
      p.closest(
        ".guardai-warning, .guardai-toast, .guardai-panel, .guardai-reopen, .guardai-msgtoggle, .guardai-pv, .guardai-pv-pop"
      )
    ) {
      return true; // our own UI
    }
    if (editor && p && (editor === p || editor.contains(p))) return true; // input field
    return false;
  }

  /**
   * Apply a set of swap rules to the text nodes inside `rootEl`. Returns the Map
   * of key -> entry actually swapped (for logging). Used both by the per-message
   * toggle and as the core of the auto-restore pass.
   */
  function applyRules(rootEl, rules) {
    const editor = findEditor();
    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (isProtectedNode(node, editor)) return NodeFilter.FILTER_REJECT;
        return node.nodeValue && node.nodeValue.trim()
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    });
    const edits = [];
    const swapped = new Map();
    let n;
    while ((n = walker.nextNode())) {
      const original = n.nodeValue;
      let value = original;
      for (const rule of rules) {
        if (rule.re.test(value)) {
          rule.re.lastIndex = 0;
          value = value.replace(rule.re, rule.to);
          swapped.set(rule.key, rule.entry);
        }
        rule.re.lastIndex = 0;
      }
      if (value !== original) edits.push([n, value]);
    }
    for (const [node, value] of edits) node.nodeValue = value;
    // Multi-word values (e.g. addresses) the AI split across separate text nodes
    // (street on one line, suburb on the next) can't be caught node-by-node, so
    // run a second pass that matches across node boundaries.
    const crossed = swapAcrossNodes(rootEl, rules);
    for (const [k, v] of crossed) swapped.set(k, v);
    return swapped;
  }

  /**
   * Replace multi-word values that span more than one text node. We concatenate
   * the eligible text nodes (joined by a newline that the flexible "[\s,]+"
   * separators match), find any rule whose match crosses a node boundary, and
   * rewrite it in place: the full replacement goes into the first node of the
   * span and the remainder of the matched text is removed from the others.
   */
  function swapAcrossNodes(rootEl, rules) {
    const swapped = new Map();
    const multi = rules.filter((r) => r.multi);
    if (!multi.length) return swapped;

    const editor = findEditor();
    const nodes = [];
    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (isProtectedNode(node, editor)) return NodeFilter.FILTER_REJECT;
        return node.nodeValue && node.nodeValue.trim()
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    });
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    if (nodes.length < 2) return swapped; // need a boundary to span

    let combined = "";
    const spans = []; // {node, start, end} positions within `combined`
    for (let i = 0; i < nodes.length; i++) {
      const start = combined.length;
      combined += nodes[i].nodeValue;
      spans.push({ node: nodes[i], start, end: combined.length });
      if (i < nodes.length - 1) combined += "\n"; // node boundary
    }

    const edits = []; // {start, end, to, rule}
    for (const rule of multi) {
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(combined))) {
        // Only handle matches that actually cross a boundary; within-node
        // matches were already done by the caller's per-node pass.
        if (m[0].indexOf("\n") !== -1) {
          edits.push({ start: m.index, end: m.index + m[0].length, to: rule.to, rule });
        }
        if (rule.re.lastIndex === m.index) rule.re.lastIndex++;
      }
      rule.re.lastIndex = 0;
    }
    if (!edits.length) return swapped;

    // Drop overlapping matches, then apply from last to first so earlier
    // offsets stay valid as node values change.
    edits.sort((a, b) => a.start - b.start);
    const kept = [];
    let lastEnd = -1;
    for (const e of edits) {
      if (e.start >= lastEnd) {
        kept.push(e);
        lastEnd = e.end;
      }
    }
    for (let i = kept.length - 1; i >= 0; i--) {
      const e = kept[i];
      applyCombinedReplacement(spans, e.start, e.end - e.start, e.to);
      swapped.set(e.rule.key, e.rule.entry);
    }
    return swapped;
  }

  /** Write `replacement` across the text nodes covered by [start, start+length). */
  function applyCombinedReplacement(spans, start, length, replacement) {
    const end = start + length;
    let placed = false;
    for (const sp of spans) {
      if (sp.end <= start || sp.start >= end) continue; // node outside the span
      const localStart = Math.max(0, start - sp.start);
      const localEnd = Math.min(sp.node.nodeValue.length, end - sp.start);
      const before = sp.node.nodeValue.slice(0, localStart);
      const after = sp.node.nodeValue.slice(localEnd);
      sp.node.nodeValue = placed ? before + after : before + replacement + after;
      placed = true;
    }
  }

  /* ------------------------------------------------------------------ *
   * Per-message "Show what AI sees" / "Show real data" toggle.
   * Each assistant message gets a small button so the user can flip that one
   * message between the fake text the AI actually stored and their real data.
   * ------------------------------------------------------------------ */
  function messageSelectors() {
    // Decorate and keep in sync BOTH the AI's response bubbles and the user's
    // own sent bubbles, so each can flip between real data and the masked text
    // the AI actually saw.
    const sels = [];
    if (CONFIG.responseMessage) sels.push(...CONFIG.responseMessage);
    else sels.push('[data-message-author-role="assistant"]');
    if (CONFIG.userMessage) sels.push(...CONFIG.userMessage);
    return sels;
  }

  function findResponseRoot() {
    for (const sel of CONFIG.responseRoot) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return document.body;
  }

  function setToggleLabel(btn, msgEl) {
    const showingReal = msgEl.getAttribute("data-guardai-view") !== "fake";
    // If currently real, the button reveals the fake; otherwise it restores real.
    btn.textContent = showingReal ? "Show what AI sees" : "Show real data";
    btn.setAttribute("data-state", showingReal ? "real" : "fake");
  }

  function toggleMessageView(msgEl, btn) {
    const showingReal = msgEl.getAttribute("data-guardai-view") !== "fake";
    if (showingReal) {
      applyRules(msgEl, buildSwapRules("remask")); // real -> fake
      msgEl.setAttribute("data-guardai-view", "fake");
      msgEl.setAttribute("data-guardai-lock", "fake"); // explicit user choice
    } else {
      const swapped = applyRules(msgEl, buildSwapRules("unmask")); // fake -> real
      msgEl.setAttribute("data-guardai-view", "real");
      msgEl.setAttribute("data-guardai-lock", "real");
      const entries = Array.from(swapped.values());
      if (entries.length) logActivity("unmask", entries);
    }
    setToggleLabel(btn, msgEl);
  }

  /**
   * When the global Auto-restore toggle flips, move every message that the user
   * hasn't individually pinned to the new default view (real when on, fake when
   * off) and refresh its button label.
   */
  function syncMessageViewsToDefault() {
    const root = findResponseRoot();
    let msgs;
    try {
      msgs = root.querySelectorAll(messageSelectors().join(","));
    } catch {
      return;
    }
    const def = state.autoRestore ? "real" : "fake";
    const rules = buildSwapRules(state.autoRestore ? "unmask" : "remask");
    msgs.forEach((el) => {
      if (el.getAttribute("data-guardai-lock")) return; // user pinned this one
      el.setAttribute("data-guardai-view", def);
      applyRules(el, rules); // bring the visible text to the new default
      const btn = el.querySelector(":scope > .guardai-msgtoggle");
      if (btn) setToggleLabel(btn, el);
    });
  }

  /** Add a toggle button to any assistant message that doesn't have one yet. */
  function decorateMessages(root) {
    const sel = messageSelectors().join(",");
    let msgs;
    try {
      msgs = root.querySelectorAll(sel);
    } catch {
      return;
    }
    msgs.forEach((msgEl) => {
      if (msgEl.querySelector(":scope > .guardai-msgtoggle")) return; // already done
      if (!msgEl.getAttribute("data-guardai-view")) {
        msgEl.setAttribute("data-guardai-view", state.autoRestore ? "real" : "fake");
      }
      const btn = document.createElement("button");
      btn.className = "guardai-msgtoggle";
      btn.type = "button";
      setToggleLabel(btn, msgEl);
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleMessageView(msgEl, btn);
      });
      msgEl.appendChild(btn);
    });
  }

  async function runUnmaskPass() {
    await masker.load();
    if (masker.size === 0) return;

    const root = findResponseRoot();

    // Make sure every assistant message has its fake/real toggle button.
    decorateMessages(root);

    // The live input editor must be skipped: it holds the masked fakes the user
    // just typed, and unmasking those back to real values would leak real data
    // straight back into the box they're about to send. Messages the user has
    // flipped to the fake view (data-guardai-view="fake") are also skipped so
    // auto-restore doesn't fight their explicit choice.
    const editor = findEditor();

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (isProtectedNode(node, editor)) return NodeFilter.FILTER_REJECT;
        const p = node.parentElement;
        // When auto-restoring, skip messages the user explicitly pinned to the
        // fake view so we don't undo their choice. When auto-restore is off we
        // still scan them (read-only) so pending items are detected for logging.
        if (state.autoRestore && p && p.closest('[data-guardai-lock="fake"]')) {
          return NodeFilter.FILTER_REJECT;
        }
        return node.nodeValue && node.nodeValue.trim()
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    });

    // Build the replacement rules. Besides each full fake -> real, we add name
    // component aliases: an AI commonly replies using just the FIRST name
    // ("Hi Liam" rather than "Hi Liam Brown"), so we also map the first- and
    // last-name tokens of a fake name back to the matching real tokens. Without
    // this the partial echo never matches and the response stays masked.
    const rules = buildSwapRules("unmask");

    const edits = [];
    const swappedEntries = new Map(); // fake (or alias) -> entry (for the log)
    let n;
    while ((n = walker.nextNode())) {
      const original = n.nodeValue;
      let value = original;
      for (const rule of rules) {
        if (rule.re.test(value)) {
          rule.re.lastIndex = 0;
          // Only rewrite the DOM when auto-restore is on. When off we just note
          // which fakes appear so the user can reveal them in the panel.
          if (state.autoRestore) value = value.replace(rule.re, rule.to);
          swappedEntries.set(rule.key, rule.entry);
        }
        rule.re.lastIndex = 0;
      }
      if (value !== original) edits.push([n, value]);
    }
    if (state.autoRestore) {
      for (const [node, value] of edits) node.nodeValue = value;
      // Catch multi-word values (addresses) the AI wrapped across text nodes.
      const crossed = swapAcrossNodes(root, rules);
      for (const [k, v] of crossed) swappedEntries.set(k, v);
    }

    // With auto-restore OFF, keep any message the user manually flipped to the
    // real view sticky across the AI's re-renders by re-applying the swap to it.
    if (!state.autoRestore) {
      let realMsgs;
      try {
        realMsgs = root.querySelectorAll(messageSelectors().join(","));
      } catch {
        realMsgs = [];
      }
      realMsgs.forEach((el) => {
        if (el.getAttribute("data-guardai-view") === "real") applyRules(el, rules);
      });
    }

    // Log only the swaps we haven't announced before. With auto-restore on these
    // are "Restored"; with it off they are "pending" reveals (response untouched).
    const fresh = [];
    for (const [fake, entry] of swappedEntries) {
      if (!announcedSwaps.has(fake)) {
        announcedSwaps.add(fake);
        fresh.push(entry);
      }
    }
    if (fresh.length) logActivity(state.autoRestore ? "unmask" : "pending", fresh);
  }

  const observer = new MutationObserver(() => scheduleUnmask());

  /* ------------------------------------------------------------------ *
   * Boot.
   * The send-interception listeners (keydown/click) are registered at module
   * scope above, so they are live the instant this script is injected. With
   * run_at:document_start that is before the page's own scripts and before the
   * user can type — detection is ready from the very first keystroke on a cold
   * page load, with no need to open the popup or interact with the extension.
   * Here we only do the asynchronous setup (settings, mapping, observer), and
   * attach the response observer as soon as <body> exists.
   * ------------------------------------------------------------------ */
  function startObserving() {
    if (!document.body) {
      // document_start: <body> may not exist yet. Re-check next frame.
      requestAnimationFrame(startObserving);
      return;
    }
    // Restore the running activity panel if this conversation already has a log.
    if (activityLog.length) {
      ensurePanel();
      renderPanel();
    }
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    // Initial pass in case a conversation with masked data is reloaded.
    scheduleUnmask();
  }

  /* ------------------------------------------------------------------ *
   * SPA soft-navigation handling.
   * Sites like ChatGPT route between conversations client-side without a full
   * page load. The document-level send listeners and the body observer survive
   * that, but stale per-send state can linger and the response root may be
   * swapped out. On every soft nav we reset that transient state, make sure the
   * observer is attached to the live <body>, and re-run a restore pass.
   * ------------------------------------------------------------------ */
  let lastHref = location.href;
  function handleSoftNav() {
    if (location.href === lastHref) return;
    lastHref = location.href;
    state.lastMaskedText = null; // don't carry a bypass into a new conversation
    bypassNext = false;
    announcedSwaps.clear(); // re-announce restores in the new view
    if (document.body) {
      try {
        observer.disconnect();
      } catch {
        /* ignore */
      }
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
    scheduleUnmask();
  }

  (function patchHistoryForSoftNav() {
    const wrap = (orig) =>
      function () {
        const ret = orig.apply(this, arguments);
        try {
          handleSoftNav();
        } catch {
          /* ignore */
        }
        return ret;
      };
    try {
      history.pushState = wrap(history.pushState);
      history.replaceState = wrap(history.replaceState);
    } catch {
      /* some pages freeze history; the poll below still covers us */
    }
    window.addEventListener("popstate", handleSoftNav);
    // Fallback for routers that change the URL without the History API hooks
    // firing in our isolated world.
    setInterval(handleSoftNav, 1000);
  })();

  async function boot() {
    // Load persisted state immediately so enabled/masking/auto-restore are
    // correct as early as possible. These need no DOM, so don't wait for it.
    await loadSettings();
    await masker.load();
    await loadActivity();
    // Warm up the optional NLP layer in the background (no-op if disabled).
    nlp.init().catch(() => {});

    startObserving();
    console.info(`[GuardAI] active on ${CONFIG.name}. All processing is local.`);
  }

  // Initialise immediately on injection — never gated behind DOMContentLoaded or
  // any user interaction, so the extension is always active from page load.
  boot();
})();
