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
    if (changes.guardai_enabled) {
      state.enabled = changes.guardai_enabled.newValue !== false;
      applyEnabledState();
    }
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
      // Never return one of our own panel/overlay elements as the chat editor.
      if (el && !el.closest(".guardai-panel, .guardai-prompt")) return el;
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
   * insertText appends rather than overwriting. Silently no-ops if the node
   * has been detached by a React/ProseMirror re-render. */
  function caretToEnd(el) {
    try {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false); // false = collapse to end
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (_) {
      /* node detached — caller handles re-find */
    }
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
    console.log("[GuardAI] typeText — clearing editor, el in DOM:", document.contains(el));
    el.focus();
    clearEditor(el);
    await delay(20);

    // React/ProseMirror can remount the editor node during the delay above.
    // Re-resolve a fresh reference if the original is now detached so that
    // subsequent operations don't throw NotFoundError.
    if (!document.contains(el)) {
      console.log("[GuardAI] typeText — editor detached after clear, re-finding...");
      const fresh = findEditor();
      if (!fresh) { console.error("[GuardAI] typeText — no fresh editor found"); return false; }
      el = fresh;
      el.focus();
      console.log("[GuardAI] typeText — re-found editor:", el);
    }

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
      // If React unmounted the editor mid-loop, stop char-by-char and fall
      // through to replaceAll which will re-find the editor.
      if (!document.contains(el)) break;
      caretToEnd(el);
      insertChar(el, ch);
      await delay(3);
    }
    el.dispatchEvent(new InputEvent("input", { bubbles: true }));
    if (normalize(getEditorText(el)).includes(normalize(text))) return true;

    // Char-by-char didn't fully land (possibly because the node was detached
    // mid-loop). Re-find the editor before the whole-string fallback.
    console.log("[GuardAI] typeText — char-by-char incomplete, falling back to replaceAll");
    if (!document.contains(el)) {
      const fresh = findEditor();
      if (fresh) { console.log("[GuardAI] typeText — re-found editor for replaceAll"); el = fresh; }
    }
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
   * Mask + type + review (NO auto-send).
   *
   * Philosophy: never fight the site's editor and never auto-send. On send we:
   *   1. compute the masked text from everything the detector found,
   *   2. clear the editor and type the masked text in (every editor accepts
   *      typing; a reliable whole-string fallback guarantees it fully lands),
   *   3. show a "Did we miss anything?" review in the side panel — the user
   *      reviews, optionally masks anything we missed (which re-types the input
   *      live), then presses send themselves.
   * The matching fake->real swap happens automatically in the AI response.
   * GuardAI never reads or writes the system clipboard, so a value the user
   * copied stays intact for their next paste.
   * ------------------------------------------------------------------ */
  /**
   * Seed the review model from the maskable auto-detected findings. The detector
   * has already resolved overlaps; warning-only findings can still be masked
   * manually later from the MESSAGE tab.
   */
  async function buildReviewModel(editor, original, findings) {
    await masker.load();
    const fakeByReal = new Map();
    const items = [];
    for (const f of findings) {
      if (!masker.isMaskable(f.type)) continue;
      let fake = fakeByReal.get(f.value);
      if (!fake) {
        fake = masker.previewFake(f.type, f.value);
        fakeByReal.set(f.value, fake);
      }
      items.push({
        start: f.index,
        end: f.index + f.value.length,
        value: f.value,
        type: f.type,
        manual: false,
        fake,
      });
    }
    items.sort((a, b) => a.start - b.start);
    review = { editor, original, items, fakeByReal };
    msgView = "ai"; // new review always opens on the "What AI sees" editable view
  }

  /** Build the masked text by applying the auto-detected items end -> start. */
  function computeMasked() {
    if (!review) return "";
    let masked = review.original;
    const ordered = review.items
      .filter((it) => it.start >= 0)
      .sort((a, b) => a.start - b.start);
    for (let i = ordered.length - 1; i >= 0; i--) {
      const it = ordered[i];
      if (masked.slice(it.start, it.end) === it.value) {
        masked = masked.slice(0, it.start) + it.fake + masked.slice(it.end);
      } else {
        masked = masked.split(it.value).join(it.fake);
      }
    }
    return masked;
  }

  /** Register every review item as a committed real<->fake pair and persist. */
  async function registerReviewItems() {
    if (!review) return;
    for (const it of review.items) masker.registerManual(it.value, it.fake, it.type);
    await masker.save();
  }

  /** Re-resolve a live editor (the stored node may have been detached by React). */
  function liveEditor() {
    return review && review.editor && document.contains(review.editor)
      ? review.editor
      : findEditor();
  }

  /**
   * "Mask & Send": mask everything detected, type it into the input, log it,
   * surface the MESSAGE tab, then send immediately — no editing step.
   */
  async function doMaskAndSend(editor, original, findings) {
    console.log("[GuardAI] doMaskAndSend — building review model");
    await buildReviewModel(editor, original, findings);
    await registerReviewItems();
    const masked = computeMasked();
    console.log("[GuardAI] doMaskAndSend — masked text:", masked);
    let live = liveEditor();
    if (!live) {
      // One retry after a short settle — the page may still be updating.
      await delay(120);
      live = liveEditor();
    }
    if (!live) {
      console.error("[GuardAI] doMaskAndSend — no editor found");
      showErrorToast("Could not find the chat input — please click in the chat box and try again.");
      return;
    }
    console.log("[GuardAI] doMaskAndSend — typing into editor:", live);
    review.editor = live;
    const ok = await typeText(live, masked);
    // typeText may have re-found a fresh editor node; re-resolve so triggerSend
    // dispatches to the element that is actually in the DOM right now.
    live = liveEditor();
    review.editor = live;
    console.log("[GuardAI] doMaskAndSend — typeText ok:", ok, "— triggering send");
    state.lastMaskedText = masked;
    const replacements = review.items.map((it) => ({
      type: it.type,
      real: it.value,
      fake: it.fake,
    }));
    logActivity("mask", replacements);
    if (ok) reportStats({ masked: replacements.length });
    // Snapshot the review so the Message tab stays populated after the soft-nav
    // that follows a successful send (handleSoftNav clears `review` but not this).
    sentReview = review;
    editMode = false;
    panelClosed = false;
    ensurePanel();
    if (reopenEl) reopenEl.style.display = "none";
    renderMessageTab();
    renderPanel();
    updateFooter();
    if (live) live.focus();
    triggerSend(live);
  }

  /**
   * "Mask & Edit": mask everything, type it into the input, then open the
   * MESSAGE tab with the masked message in an editable box. A footer Send
   * button appears; the user edits freely and sends when ready.
   */
  async function doMaskAndEdit(editor, original, findings) {
    console.log("[GuardAI] doMaskAndEdit — building review model");
    await buildReviewModel(editor, original, findings);
    await registerReviewItems();
    const masked = computeMasked();
    console.log("[GuardAI] doMaskAndEdit — masked text:", masked);
    let live = liveEditor();
    if (!live) {
      // One retry after a short settle — the page may still be updating.
      await delay(120);
      live = liveEditor();
    }
    if (!live) {
      console.error("[GuardAI] doMaskAndEdit — no editor found");
      showErrorToast("Could not find the chat input — please click in the chat box and try again.");
      return;
    }
    console.log("[GuardAI] doMaskAndEdit — typing into editor:", live);
    review.editor = live;
    const ok = await typeText(live, masked);
    // Re-resolve in case typeText found a fresh editor node during re-render.
    live = liveEditor();
    review.editor = live;
    console.log("[GuardAI] doMaskAndEdit — typeText ok:", ok, "— opening panel");
    state.lastMaskedText = masked;
    const replacements = review.items.map((it) => ({
      type: it.type,
      real: it.value,
      fake: it.fake,
    }));
    logActivity("mask", replacements);
    if (ok) reportStats({ masked: replacements.length });
    editMode = true;
    panelClosed = false;
    ensurePanel();
    if (reopenEl) reopenEl.style.display = "none";
    renderMessageTab();
    renderPanel();
    setActiveTab("message");
    updateFooter();
    if (live) live.focus();
  }

  /**
   * Trigger the platform's send action robustly: poll for an enabled send
   * button (up to ~1.5s) and click it; only fall back to a synthetic Enter if
   * no usable button appears.
   */
  function triggerSend(editor) {
    console.log("[GuardAI] triggerSend — polling for send button");
    let tries = 0;
    const MAX = 30; // ~1.5s at 50ms
    const attempt = () => {
      tries++;
      const btn = findEnabledSendButton();
      if (btn) {
        console.log("[GuardAI] triggerSend — clicking send button:", btn);
        bypassNext = true; // let our own click pass through the interceptor
        btn.click();
        return;
      }
      if (tries < MAX) {
        setTimeout(attempt, 50);
        return;
      }
      // Fallback: synthetic Enter on the editor. Prefer a freshly-resolved
      // editor over the possibly-detached captured reference.
      console.log("[GuardAI] triggerSend — no send button found after", MAX, "tries, firing synthetic Enter");
      const live = (document.contains(editor) ? editor : null) || findEditor();
      if (!live) { console.error("[GuardAI] triggerSend — no editor for Enter fallback"); return; }
      bypassNext = true;
      live.focus();
      live.dispatchEvent(
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
  let maskedListEl = null; // MASKED tab: the activity-log list
  let reopenEl = null;
  let panelClosed = false; // user explicitly closed the panel this session
  let activeTab = "masked"; // "masked" | "message"
  let editMode = false; // a Mask & Edit is in progress -> show the panel Send button
  // MESSAGE tab elements (created with the panel).
  let msgPaneEl = null;
  let msgEditableEl = null;
  let msgLegendEl = null;
  let msgEmptyEl = null;
  let footerSendEl = null;
  let msgApplyEl = null; // "Apply changes" button in the MESSAGE tab
  let msgHintEl = null; // "Highlight any text to manually mask it" instruction
  let msgRealViewEl = null; // MESSAGE tab "What you see" read-only view
  let msgViewTabsEl = null; // the "What AI sees / What you see" sub-tab bar
  let msgView = "ai"; // "ai" = masked (editable) | "you" = original (read-only)
  let markTipEl = null; // hover tooltip on a mark (Remove mask / Change replacement)
  let markTipFor = null; // the mark element the tip currently belongs to
  let markTipHideT = null; // delayed-hide timer for the mark tooltip
  let maskPromptEl = null; // the "Mask & Send / Mask & Edit" bar above the input

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
      `<span class="guardai-panel__title">GuardAI</span>` +
      `<button class="guardai-panel__close" title="Close" aria-label="Close">&times;</button>` +
      `</div>` +
      `<div class="guardai-panel__toggle">` +
      `<div class="guardai-panel__toggletext">` +
      `<span class="guardai-panel__togglelabel">Auto-restore</span>` +
      `<span class="guardai-panel__togglehint"></span>` +
      `</div>` +
      `<button class="guardai-panel__switch" role="switch"></button>` +
      `</div>` +
      `<div class="guardai-panel__tabs" role="tablist">` +
      `<button class="guardai-panel__tab guardai-panel__tab--active" data-tab="masked" role="tab">Masked</button>` +
      `<button class="guardai-panel__tab" data-tab="message" role="tab">Message</button>` +
      `</div>` +
      `<div class="guardai-panel__body">` +
      `<div class="guardai-panel__pane guardai-panel__pane--active" data-pane="masked">` +
      `<div class="guardai-panel__list"></div>` +
      `</div>` +
      `<div class="guardai-panel__pane" data-pane="message">` +
      `<div class="guardai-panel__msgviews" style="display:none">` +
      `<button class="guardai-panel__msgview guardai-panel__msgview--active" data-msgview="ai">What AI sees</button>` +
      `<button class="guardai-panel__msgview" data-msgview="you">What you see</button>` +
      `</div>` +
      `<div class="guardai-panel__msglegend"></div>` +
      `<p class="guardai-panel__msghint">Highlight any text to manually mask it</p>` +
      `<div class="guardai-panel__editable" contenteditable="true" spellcheck="false"></div>` +
      `<div class="guardai-panel__readview" style="display:none"></div>` +
      `<button class="guardai-panel__apply" style="display:none">Apply changes</button>` +
      `<div class="guardai-panel__msgempty">Nothing to edit yet. Choose <b>Mask &amp; Edit</b> when GuardAI detects sensitive data and your masked message appears here.</div>` +
      `</div>` +
      `</div>` +
      `<div class="guardai-panel__footer">` +
      `<button class="guardai-panel__send" style="display:none">Send</button>` +
      `<button class="guardai-panel__clear">Clear session</button>` +
      `</div>`;
    document.body.appendChild(panelEl);
    maskedListEl = panelEl.querySelector(".guardai-panel__list");
    msgPaneEl = panelEl.querySelector('[data-pane="message"]');
    msgEditableEl = panelEl.querySelector(".guardai-panel__editable");
    msgLegendEl = panelEl.querySelector(".guardai-panel__msglegend");
    msgEmptyEl = panelEl.querySelector(".guardai-panel__msgempty");
    footerSendEl = panelEl.querySelector(".guardai-panel__send");
    msgApplyEl = panelEl.querySelector(".guardai-panel__apply");
    msgHintEl = panelEl.querySelector(".guardai-panel__msghint");
    msgRealViewEl = panelEl.querySelector(".guardai-panel__readview");
    msgViewTabsEl = panelEl.querySelector(".guardai-panel__msgviews");

    msgEditableEl.addEventListener("mouseup", msgHandleSelection);
    msgEditableEl.addEventListener("mouseover", msgMarkHover);
    msgApplyEl.onclick = applyMessageEdits;
    if (msgViewTabsEl) {
      msgViewTabsEl.querySelectorAll(".guardai-panel__msgview").forEach((b) => {
        b.onclick = () => setMsgView(b.getAttribute("data-msgview"));
      });
    }
    panelEl.querySelector(".guardai-panel__close").onclick = closePanel;
    panelEl.querySelector(".guardai-panel__switch").onclick = () =>
      setAutoRestore(!state.autoRestore);
    panelEl.querySelectorAll(".guardai-panel__tab").forEach((tab) => {
      tab.onclick = () => setActiveTab(tab.getAttribute("data-tab"));
    });
    footerSendEl.onclick = panelSend;
    panelEl.querySelector(".guardai-panel__clear").onclick = clearSession;
    // Delegate "Reveal real data" clicks for pending rows.
    maskedListEl.addEventListener("click", (e) => {
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
    setActiveTab(activeTab);
    renderMessageTab();
    updateFooter();
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
    review = null;
    sentReview = null;
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
        renderMessageTab();
        renderPanel();
      };
      document.body.appendChild(reopenEl);
    }
    reopenEl.querySelector(".guardai-reopen__count").textContent = String(activityLog.length);
    reopenEl.style.display = "";
  }

  function renderPanel() {
    if (!maskedListEl) return;
    if (!activityLog.length) {
      maskedListEl.innerHTML =
        `<div class="guardai-panel__empty">No activity yet. When you mask data or ` +
        `GuardAI restores a response, it appears here.</div>`;
      return;
    }
    // Newest first, capped to the most recent 20 so the log never stacks endlessly.
    maskedListEl.innerHTML = activityLog
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

  async function handleSendAttempt(editor) {
    if (!state.enabled) return true; // extension off -> allow

    const text = getEditorText(editor).trim();
    if (!text) return true;

    // If this is the exact masked text we just typed in, the user is sending
    // it themselves — let it through untouched (don't re-scan/re-mask). The
    // review persists so the MESSAGE tab still reflects what was sent.
    if (state.lastMaskedText && normalize(text) === normalize(state.lastMaskedText)) {
      state.lastMaskedText = null;
      return true;
    }

    const findings = await scanText(text);

    // Nothing sensitive -> let it fly.
    if (!findings.length) return true;

    reportStats({ detected: findings.length });

    // Educate first: show the warning popup listing each detected item, the
    // category, and WHY it's risky on this platform. From there the user picks
    // Cancel, Send anyway, Mask & Send, or Mask & Edit. We block this raw send.
    showWarning(editor, text, findings, makeResender(editor));
    return false;
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
      if (!state.enabled) return; // master off — never intercept the send
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

      const allow = await handleSendAttempt(editor);
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
      if (!state.enabled) return; // master off — never intercept the send

      if (bypassNext) {
        bypassNext = false;
        return;
      }

      const editor = findEditor();
      if (!editor) return;

      e.preventDefault();
      e.stopImmediatePropagation();

      const allow = await handleSendAttempt(editor);
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

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /** Show a brief error banner so the user sees failures without opening DevTools. */
  function showErrorToast(msg) {
    const t = document.createElement("div");
    t.className = "guardai-toast guardai-toast--error";
    t.textContent = "\u26A0\uFE0F GuardAI: " + msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 6000);
  }

  /* ------------------------------------------------------------------ *
   * "Did we miss anything?" review — lives in the side panel.
   * On send we auto-mask everything detected and type the masked text into the
   * input. This section then shows the user's ORIGINAL message with every
   * masked item highlighted in a per-type colour, and lets them mask anything
   * we missed by selecting it. A manual mask re-types the input field in real
   * time. The user reviews and presses send themselves. No overlay, nothing is
   * sent automatically. Detection, masking and auto-restore are reused as-is.
   * ------------------------------------------------------------------ */
  const MARK_STYLE = {
    NAME_PII: { label: "Name", color: "#6B9FFF" },
    PHONE: { label: "Phone", color: "#FF8C42" },
    EMAIL: { label: "Email", color: "#4CAF82" },
    ADDRESS: { label: "Address", color: "#B06FFF" },
    DOB: { label: "Date of birth", color: "#FFD166" },
    PASSPORT: { label: "Passport", color: "#FF6B6B" },
    LICENCE: { label: "Licence", color: "#FF6B6B" },
    MEDICARE: { label: "Medicare", color: "#FF6B6B" },
    TFN: { label: "TFN", color: "#FF6B6B" },
    CREDIT_CARD: { label: "Card number", color: "#FF6B6B" },
    BSB: { label: "BSB", color: "#FF6B6B" },
    BANK_ACCOUNT: { label: "Bank account", color: "#FF6B6B" },
    MONEY: { label: "Amount", color: "#FFD166" },
    GPS: { label: "GPS", color: "#B06FFF" },
    ABN: { label: "ABN", color: "#FF6B6B" },
    ACN: { label: "ACN", color: "#FF6B6B" },
    PASSWORD: { label: "Password", color: "#FF6B6B" },
  };
  const MARK_DEFAULT = { label: "Sensitive", color: "#FFD166" };
  const MARK_MANUAL = { label: "Manual", color: "#FF8FB1" };

  // Active review state: { editor, original, items[], fakeByReal }.
  // items: [{ start, end, value, type, manual, fake }]. Items added manually in
  // the MESSAGE tab use start/end of -1 (their position lives in the DOM).
  let review = null;
  // Snapshot of the last successfully sent review, kept so the Message tab
  // remains populated after sending (soft-nav clears `review` but not this).
  // Cleared only by clearSession().
  let sentReview = null;
  let msgPending = null; // { range: Range, value: string } awaiting auto/custom replace
  let msgPop = null; // the auto/custom replace popup element

  function markStyle(type, manual) {
    return MARK_STYLE[type] || (manual ? MARK_MANUAL : MARK_DEFAULT);
  }

  /* ---- Educational warning popup above the input ----
   * The first thing the user sees on detection. It lists each detected item by
   * category, explains in plain English WHY each is risky on this platform, and
   * offers four choices: Cancel, Send anyway, Mask & Send, Mask & Edit. This is
   * the teaching moment that makes GuardAI useful for non-technical users. */

  function showWarning(editor, text, findings, resend) {
    dismissMaskPrompt();

    // Group findings by type so the list shows one row per category, with a
    // count and the shared "why it's risky" reason.
    const groups = {};
    for (const f of findings) {
      const g =
        groups[f.type] ||
        (groups[f.type] = { label: f.label, reason: f.reason, items: [] });
      g.items.push(f.value);
    }

    const wrap = document.createElement("div");
    wrap.className = "guardai-prompt guardai-prompt--warn";
    wrap.setAttribute("role", "alertdialog");
    wrap.setAttribute("aria-live", "polite");

    const rows = Object.keys(groups)
      .map((key) => {
        const g = groups[key];
        return (
          `<li class="guardai-prompt__item">` +
          `<div class="guardai-prompt__itemhead">` +
          `<span class="guardai-prompt__cat">${escapeHtml(g.label)}</span>` +
          `<span class="guardai-prompt__count">${g.items.length}</span>` +
          `</div>` +
          (g.reason
            ? `<p class="guardai-prompt__why">${escapeHtml(g.reason)}</p>`
            : "") +
          `</li>`
        );
      })
      .join("");

    wrap.innerHTML =
      `<div class="guardai-prompt__grip" title="Drag to move" aria-label="Drag to move"></div>` +
      `<div class="guardai-prompt__head">` +
      `<span class="guardai-prompt__shield">&#128737;</span>` +
      `<span class="guardai-prompt__text">GuardAI detected sensitive data</span>` +
      `<button class="guardai-prompt__close" aria-label="Dismiss">&times;</button>` +
      `</div>` +
      `<p class="guardai-prompt__platform">Sending to ${escapeHtml(
        CONFIG.name
      )}: ${escapeHtml(CONFIG.note || "")}</p>` +
      `<ul class="guardai-prompt__list">${rows}</ul>` +
      `<div class="guardai-prompt__btns">` +
      `<button class="guardai-prompt__btn guardai-prompt__btn--send">Mask &amp; Send</button>` +
      `<button class="guardai-prompt__btn guardai-prompt__btn--edit">Mask &amp; Edit</button>` +
      `</div>` +
      `<div class="guardai-prompt__btns guardai-prompt__btns--secondary">` +
      `<button class="guardai-prompt__btn guardai-prompt__btn--ghost guardai-prompt__btn--anyway">Send anyway</button>` +
      `<button class="guardai-prompt__btn guardai-prompt__btn--ghost guardai-prompt__btn--cancel">Cancel</button>` +
      `</div>`;
    document.body.appendChild(wrap);
    maskPromptEl = wrap;

    wrap.querySelector(".guardai-prompt__close").onclick = () => {
      console.log("[GuardAI] ✕ Close clicked — dismissing popup");
      dismissMaskPrompt();
      const live = editor && document.contains(editor) ? editor : findEditor();
      if (live) live.focus();
    };
    wrap.querySelector(".guardai-prompt__btn--cancel").onclick = () => {
      console.log("[GuardAI] Cancel clicked — dismissing popup, restoring focus");
      dismissMaskPrompt();
      const live = editor && document.contains(editor) ? editor : findEditor();
      if (live) live.focus();
    };
    wrap.querySelector(".guardai-prompt__btn--anyway").onclick = () => {
      console.log("[GuardAI] Send Anyway clicked — sending original unmasked text");
      dismissMaskPrompt();
      reportStats({ sentUnmasked: 1 });
      resend();
    };
    wrap.querySelector(".guardai-prompt__btn--send").onclick = () => {
      console.log("[GuardAI] Mask & Send clicked — starting mask flow");
      dismissMaskPrompt();
      doMaskAndSend(editor, text, findings).catch((err) => {
        console.error("[GuardAI] Mask & Send failed:", err);
        showErrorToast("Mask & Send failed — please reload the page and try again.");
      });
    };
    wrap.querySelector(".guardai-prompt__btn--edit").onclick = () => {
      console.log("[GuardAI] Mask & Edit clicked — starting mask+review flow");
      dismissMaskPrompt();
      doMaskAndEdit(editor, text, findings).catch((err) => {
        console.error("[GuardAI] Mask & Edit failed:", err);
        showErrorToast("Mask & Edit failed — please reload the page and try again.");
      });
    };

    // Centre the popup horizontally and place it slightly above the middle of
    // the viewport, so it's always fully visible no matter where the input is.
    centrePrompt(wrap);
    makePromptDraggable(wrap);

    // Keep it centred on resize — but only until the user drags it, after which
    // it stays exactly where they put it for the rest of the session.
    const reposition = () => {
      if (!wrap._dragged) centrePrompt(wrap);
    };
    window.addEventListener("resize", reposition, true);
    wrap._cleanup = () => {
      window.removeEventListener("resize", reposition, true);
    };
  }

  /** Centre horizontally, sit at ~1/3 from the top of the viewport, clamped. */
  function centrePrompt(el) {
    const w = el.offsetWidth || 400;
    const h = el.offsetHeight || 320;
    let left = (window.innerWidth - w) / 2;
    // Position the TOP of the popup at 1/3 of the viewport height, so the user
    // can still see their message in the input below it.
    let top = Math.round(window.innerHeight / 3) - Math.round(h / 4);
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - h - 8));
    el.style.left = left + "px";
    el.style.top = top + "px";
  }

  /** Let the user drag the popup by its grip/header; it stays where dropped. */
  function makePromptDraggable(el) {
    const handles = [
      el.querySelector(".guardai-prompt__grip"),
      el.querySelector(".guardai-prompt__head"),
    ].filter(Boolean);
    let startX = 0;
    let startY = 0;
    let baseLeft = 0;
    let baseTop = 0;

    const onMove = (e) => {
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      const y = e.touches ? e.touches[0].clientY : e.clientY;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      let left = baseLeft + (x - startX);
      let top = baseTop + (y - startY);
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
      top = Math.max(8, Math.min(top, window.innerHeight - h - 8));
      el.style.left = left + "px";
      el.style.top = top + "px";
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("mouseup", onUp, true);
      document.removeEventListener("touchmove", onMove, true);
      document.removeEventListener("touchend", onUp, true);
      el.classList.remove("guardai-prompt--dragging");
    };
    const onDown = (e) => {
      // Don't start a drag from the close button or any control.
      if (e.target.closest("button, input")) return;
      const pt = e.touches ? e.touches[0] : e;
      startX = pt.clientX;
      startY = pt.clientY;
      const rect = el.getBoundingClientRect();
      baseLeft = rect.left;
      baseTop = rect.top;
      el._dragged = true;
      el.classList.add("guardai-prompt--dragging");
      e.preventDefault();
      document.addEventListener("mousemove", onMove, true);
      document.addEventListener("mouseup", onUp, true);
      document.addEventListener("touchmove", onMove, { capture: true, passive: false });
      document.addEventListener("touchend", onUp, true);
    };

    for (const h of handles) {
      h.addEventListener("mousedown", onDown, true);
      h.addEventListener("touchstart", onDown, { capture: true, passive: false });
    }
  }

  function dismissMaskPrompt() {
    if (maskPromptEl) {
      if (maskPromptEl._cleanup) maskPromptEl._cleanup();
      maskPromptEl.remove();
      maskPromptEl = null;
    }
  }

  /* ---- MESSAGE tab: editable masked message + manual masking ---- */

  /**
   * Rebuild the editable MESSAGE pane from the review model: plain text from the
   * original, with each auto-masked item shown as a coloured (non-editable) mark
   * carrying its fake value. Free typing and manual selection-masks then mutate
   * this DOM directly; innerText is the source of truth on send.
   */
  function renderMessageTab() {
    if (!msgEditableEl) return;
    // Use `review` if active; fall back to `sentReview` so the tab stays
    // populated after a successful send (when soft-nav clears `review`).
    const activeReview = review || sentReview;
    const positioned = activeReview
      ? activeReview.items.filter((it) => it.start >= 0).sort((a, b) => a.start - b.start)
      : [];
    if (!activeReview || !activeReview.items.length) {
      msgEditableEl.innerHTML = "";
      msgEditableEl.style.display = "none";
      if (msgHintEl) msgHintEl.style.display = "none";
      if (msgRealViewEl) {
        msgRealViewEl.innerHTML = "";
        msgRealViewEl.style.display = "none";
      }
      if (msgViewTabsEl) msgViewTabsEl.style.display = "none";
      if (msgEmptyEl) msgEmptyEl.style.display = "";
      if (msgLegendEl) msgLegendEl.innerHTML = "";
      if (msgApplyEl) msgApplyEl.style.display = "none";
      hideMarkTip();
      return;
    }
    if (msgEmptyEl) msgEmptyEl.style.display = "none";
    // In the sent (read-only) state the editable hint is not relevant.
    if (msgHintEl) msgHintEl.style.display = review ? "" : "none";

    // "What AI sees": surrounding real text + marks showing the fake, with the
    // real value as a small grey caption underneath each mark.
    const out = [];
    let cursor = 0;
    for (const it of positioned) {
      if (it.start > cursor) out.push(escapeHtml(activeReview.original.slice(cursor, it.start)));
      out.push(markHtml(it, "ai"));
      cursor = it.end;
    }
    if (cursor < activeReview.original.length) out.push(escapeHtml(activeReview.original.slice(cursor)));
    // Append any manual (start<0) items that aren't part of the original text run.
    for (const it of activeReview.items) {
      if (it.start < 0) out.push(" " + markHtml(it, "ai"));
    }
    msgEditableEl.innerHTML = out.join("");

    buildReadView();
    renderMsgLegend();
    applyMsgView();
  }

  /**
   * Build the read-only "What you see" view by transforming the editable's
   * current DOM: every mark shows its REAL value with the coloured highlight,
   * and nothing underneath. Derived from the editable so it always matches the
   * live message (including free edits and in-place manual masks).
   */
  function buildReadView() {
    if (!msgRealViewEl || !msgEditableEl) return;
    const clone = msgEditableEl.cloneNode(true);
    clone.querySelectorAll(".guardai-panel__mark").forEach((m) => {
      const real = m.getAttribute("data-real") || "";
      m.textContent = real;
      // No grey fake-value caption in the "What you see" view — keep only the
      // coloured highlight on the real word.
      m.removeAttribute("data-sub");
    });
    msgRealViewEl.innerHTML = clone.innerHTML;
  }

  /** Switch between the "What AI sees" (editable) and "What you see" views. */
  function setMsgView(v) {
    msgView = v === "you" ? "you" : "ai";
    applyMsgView();
  }

  /** Apply the current msgView: toggle which view is visible + the sub-tabs. */
  function applyMsgView() {
    const activeReview = review || sentReview;
    const hasItems = !!(activeReview && activeReview.items.length);
    // Editing controls only apply when a live (unsent) review is active.
    const isEditable = !!(review && review.items.length);
    if (msgViewTabsEl) {
      msgViewTabsEl.style.display = hasItems ? "" : "none";
      msgViewTabsEl.querySelectorAll(".guardai-panel__msgview").forEach((b) => {
        b.classList.toggle(
          "guardai-panel__msgview--active",
          b.getAttribute("data-msgview") === msgView
        );
      });
    }
    const showYou = msgView === "you";
    if (msgEditableEl) {
      msgEditableEl.style.display = hasItems && !showYou ? "" : "none";
      // Make read-only when showing the sent snapshot (no live review to edit).
      msgEditableEl.contentEditable = isEditable ? "true" : "false";
    }
    if (msgRealViewEl) msgRealViewEl.style.display = hasItems && showYou ? "" : "none";
    // Hint and Apply only apply to the live editable "What AI sees" view.
    if (msgHintEl) msgHintEl.style.display = isEditable && !showYou ? "" : "none";
    if (msgApplyEl) msgApplyEl.style.display = isEditable && !showYou ? "" : "none";
    hideMarkTip();
  }

  /**
   * Build the HTML for a masked item. `view` is "ai" (show the fake, real as the
   * grey caption) or "you" (show the real, fake as the caption). data-real and
   * data-fake are always carried so the hover tooltip can act on the item.
   * innerText still equals the fake in the editable, so sends stay masked.
   */
  function markHtml(it, view) {
    const st = markStyle(it.type, it.manual);
    const secret = it.type === "PASSWORD" ? " guardai-panel__mark--secret" : "";
    const main = view === "you" ? it.value : it.fake;
    const sub = view === "you" ? it.fake : it.value;
    const subAttr = it.type === "PASSWORD" ? "" : ` data-sub="${escapeHtml(sub)}"`;
    return (
      `<mark class="guardai-panel__mark${secret}" contenteditable="false" ` +
      `data-type="${escapeHtml(it.type)}" data-real="${escapeHtml(it.value)}" ` +
      `data-fake="${escapeHtml(it.fake)}" style="--mk:${st.color}"${subAttr}>` +
      escapeHtml(main) +
      `</mark>`
    );
  }

  /* ---- Hover tooltip: remove a mask or change its replacement ---- */

  /** On hover over a mark in the editable, offer Remove mask / Change replacement. */
  function msgMarkHover(e) {
    if (!review) return;
    const mark = e.target && e.target.closest && e.target.closest(".guardai-panel__mark");
    if (!mark || !msgEditableEl.contains(mark)) return;
    showMarkTip(mark);
  }

  function showMarkTip(mark) {
    if (markTipFor === mark && markTipEl) {
      clearTimeout(markTipHideT);
      return;
    }
    hideMarkTip();
    markTipFor = mark;
    const tip = document.createElement("div");
    tip.className = "guardai-review-pop guardai-mark-tip";
    tip.innerHTML =
      `<button class="guardai-review-pop__btn" data-act="remove">Remove mask</button>` +
      `<button class="guardai-review-pop__btn" data-act="change">Change replacement</button>`;
    document.body.appendChild(tip);
    markTipEl = tip;
    tip.querySelector('[data-act="remove"]').onclick = () => removeMark(mark);
    tip.querySelector('[data-act="change"]').onclick = () => changeMarkUI(mark);
    tip.addEventListener("mouseenter", () => clearTimeout(markTipHideT));
    tip.addEventListener("mouseleave", scheduleHideMarkTip);
    mark.addEventListener("mouseleave", scheduleHideMarkTip);
    positionMarkTip(tip, mark.getBoundingClientRect());
  }

  function positionMarkTip(tip, rect) {
    const w = tip.offsetWidth || 220;
    let left = rect.left + rect.width / 2 - w / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = rect.top - (tip.offsetHeight || 40) - 8;
    if (top < 8) top = rect.bottom + 8;
    tip.style.left = left + "px";
    tip.style.top = top + "px";
  }

  function scheduleHideMarkTip() {
    clearTimeout(markTipHideT);
    markTipHideT = setTimeout(hideMarkTip, 220);
  }

  function hideMarkTip() {
    clearTimeout(markTipHideT);
    if (markTipEl) {
      markTipEl.remove();
      markTipEl = null;
    }
    markTipFor = null;
  }

  /** "Remove mask": restore the real value in place and forget the mapping. */
  async function removeMark(mark) {
    if (!review || !mark) return;
    const real = mark.getAttribute("data-real");
    const oldFake = mark.getAttribute("data-fake") || mark.textContent;
    hideMarkTip();
    // Restore the real text where the mark was.
    if (mark.parentNode) {
      mark.parentNode.replaceChild(document.createTextNode(real), mark);
    }
    // Drop one matching item from the model.
    const i = review.items.findIndex((it) => it.value === real);
    if (i >= 0) review.items.splice(i, 1);
    // If nothing else uses this value, forget the mapping entirely.
    if (!review.items.some((it) => it.value === real)) {
      if (review.fakeByReal) review.fakeByReal.delete(real);
      masker.unregister(real);
      await masker.save();
    }
    removeActivityByFake(oldFake);
    buildReadView();
    renderMsgLegend();
    renderPanel();
    await syncLiveInput();
  }

  /** "Change replacement": swap the tooltip for an input to type a new fake. */
  function changeMarkUI(mark) {
    if (!markTipEl) showMarkTip(mark);
    const tip = markTipEl;
    if (!tip) return;
    clearTimeout(markTipHideT);
    const current = mark.getAttribute("data-fake") || mark.textContent;
    tip.innerHTML =
      `<input class="guardai-review-pop__input" type="text" placeholder="New replacement" />` +
      `<button class="guardai-review-pop__btn guardai-review-pop__go" data-act="go">Apply</button>`;
    const input = tip.querySelector(".guardai-review-pop__input");
    input.value = current;
    const commit = () => {
      const v = input.value.trim();
      if (v) applyMarkChange(mark, v);
    };
    tip.querySelector('[data-act="go"]').onclick = commit;
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        hideMarkTip();
      }
    });
    input.focus();
    input.select();
    positionMarkTip(tip, mark.getBoundingClientRect());
  }

  /** Re-point a mark to a new fake value and refresh everything that shows it. */
  async function applyMarkChange(mark, newFake) {
    if (!review || !mark) return;
    const real = mark.getAttribute("data-real");
    const type = mark.getAttribute("data-type") || "CUSTOM";
    const oldFake = mark.getAttribute("data-fake") || mark.textContent;
    hideMarkTip();
    if (newFake === oldFake) return;
    masker.unregister(real);
    masker.registerManual(real, newFake, type);
    await masker.save();
    // Update the live mark in the editable.
    mark.textContent = newFake;
    mark.setAttribute("data-fake", newFake);
    if (type !== "PASSWORD") mark.setAttribute("data-sub", real);
    // Update the model + the MASKED tab.
    for (const it of review.items) {
      if (it.value === real) it.fake = newFake;
    }
    if (review.fakeByReal) review.fakeByReal.set(real, newFake);
    removeActivityByFake(oldFake);
    logActivity("mask", [{ type, real, fake: newFake }]);
    buildReadView();
    renderMsgLegend();
    renderPanel();
    await syncLiveInput();
  }

  /** Remove the MASKED-tab activity entries for a fake (when un/re-masking). */
  function removeActivityByFake(fake) {
    const gone = activityLog.filter((e) => e.kind === "mask" && e.fake === fake);
    if (!gone.length) return;
    activityLog = activityLog.filter((e) => !(e.kind === "mask" && e.fake === fake));
    for (const e of gone) loggedKeys.delete(e.kind + "|" + e.fake + "|" + e.real);
    persistActivity();
  }

  function renderMsgLegend() {
    if (!msgLegendEl) return;
    const seen = new Map();
    const activeReview = review || sentReview;
    if (activeReview) {
      for (const it of activeReview.items) {
        const st = markStyle(it.type, it.manual);
        if (!seen.has(st.label)) seen.set(st.label, st.color);
      }
    }
    msgLegendEl.innerHTML = Array.from(seen.entries())
      .map(
        ([label, color]) =>
          `<span class="guardai-panel__legenditem">` +
          `<span class="guardai-panel__dot" style="background:${color}"></span>` +
          escapeHtml(label) +
          `</span>`
      )
      .join("");
  }

  /** On a selection inside the editable, offer to mask the highlighted text. */
  function msgHandleSelection() {
    if (!review || !msgEditableEl) return msgHidePopup();
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return msgHidePopup();
    const range = sel.getRangeAt(0);
    if (
      !msgEditableEl.contains(range.startContainer) ||
      !msgEditableEl.contains(range.endContainer)
    )
      return msgHidePopup();
    // Reject selections that touch an already-masked item.
    const marks = msgEditableEl.querySelectorAll(".guardai-panel__mark");
    for (const m of marks) {
      if (range.intersectsNode(m)) return msgHidePopup();
    }
    const value = sel.toString();
    if (value.trim().length < 1) return msgHidePopup();
    msgPending = { range: range.cloneRange(), value };
    msgShowPopup(range.getBoundingClientRect());
  }

  function msgShowPopup(rect) {
    msgHidePopup();
    const pop = document.createElement("div");
    pop.className = "guardai-review-pop";
    pop.innerHTML =
      `<button class="guardai-review-pop__btn" data-act="auto">Auto-replace</button>` +
      `<button class="guardai-review-pop__btn" data-act="custom">Custom replace</button>`;
    document.body.appendChild(pop);
    msgPop = pop;
    pop.querySelector('[data-act="auto"]').onclick = msgAutoReplace;
    pop.querySelector('[data-act="custom"]').onclick = msgCustomReplaceUI;

    const w = pop.offsetWidth || 220;
    let left = rect.left + rect.width / 2 - w / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = rect.top - (pop.offsetHeight || 40) - 8;
    if (top < 8) top = rect.bottom + 8;
    pop.style.left = left + "px";
    pop.style.top = top + "px";
  }

  function msgHidePopup() {
    if (msgPop) {
      msgPop.remove();
      msgPop = null;
    }
  }

  function msgAutoReplace() {
    if (!msgPending) return;
    const value = msgPending.value.trim();
    let type = "NAME_PII"; // a realistic AU name is the generic fallback
    try {
      const fs = detector.scan(value);
      const whole = fs.find((f) => masker.isMaskable(f.type) && f.value.trim() === value);
      const any = whole || fs.find((f) => masker.isMaskable(f.type));
      if (any) type = any.type;
    } catch {
      /* fall back to NAME_PII */
    }
    msgReplaceSelection(masker.previewFake(type, value), type);
  }

  /** Swap the popup for a small input so the user can type their own fake. */
  function msgCustomReplaceUI() {
    if (!msgPop) return;
    msgPop.innerHTML =
      `<input class="guardai-review-pop__input" type="text" placeholder="Your replacement" />` +
      `<button class="guardai-review-pop__btn guardai-review-pop__go" data-act="go">Apply</button>`;
    const input = msgPop.querySelector(".guardai-review-pop__input");
    const commit = () => {
      const v = input.value.trim();
      if (v) msgReplaceSelection(v, "CUSTOM");
    };
    // Confirm on click of "Apply" or by pressing Enter in the field.
    msgPop.querySelector('[data-act="go"]').onclick = commit;
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        msgHidePopup();
      }
    });
    input.focus();
  }

  /**
   * Replace the pending selection in the editable with a coloured mark carrying
   * the fake, register the real<->fake pair, log it, and re-type the live chat
   * input so the masked change is reflected in real time before the user sends.
   * The editable DOM is mutated in place so other edits are preserved.
   */
  async function msgReplaceSelection(fake, type) {
    if (!review || !msgPending) return;
    const raw = msgPending.value;
    const real = raw.trim();
    const lead = raw.slice(0, raw.indexOf(real));
    const tail = raw.slice(raw.indexOf(real) + real.length);

    masker.registerManual(real, fake, type);
    await masker.save();

    const st = markStyle(type, true);
    const mark = document.createElement("mark");
    mark.className =
      "guardai-panel__mark" + (type === "PASSWORD" ? " guardai-panel__mark--secret" : "");
    mark.setAttribute("contenteditable", "false");
    mark.setAttribute("data-type", type);
    mark.setAttribute("data-real", real);
    mark.setAttribute("data-fake", fake);
    if (type !== "PASSWORD") mark.setAttribute("data-sub", real); // grey original underneath
    mark.style.setProperty("--mk", st.color);
    mark.textContent = fake; // real fake stays; CSS hides passwords visually

    const frag = document.createDocumentFragment();
    if (lead) frag.appendChild(document.createTextNode(lead));
    frag.appendChild(mark);
    if (tail) frag.appendChild(document.createTextNode(tail));

    const range = msgPending.range;
    range.deleteContents();
    range.insertNode(frag);

    const sel = window.getSelection();
    if (sel) sel.removeAllRanges();
    msgPending = null;
    msgHidePopup();

    review.items.push({ start: -1, end: -1, value: real, type, manual: true, fake });
    review.fakeByReal.set(real, fake);
    logActivity("mask", [{ type, real, fake }]); // shows in the MASKED tab
    buildReadView(); // keep "What you see" in sync with the new manual mask
    renderMsgLegend();
    renderPanel();
    await syncLiveInput(); // reflect the change in the chat input immediately
  }

  /**
   * Push the current MESSAGE-tab text into the live chat input. Called after a
   * manual mask so the input always matches what the user sees in the panel.
   */
  async function syncLiveInput() {
    if (!msgEditableEl) return;
    const live = liveEditor();
    if (!live) return;
    if (review) review.editor = live;
    let finalText = msgEditableEl.innerText.replace(/\u00a0/g, " ").replace(/\s+$/, "");
    await typeText(live, finalText);
    state.lastMaskedText = finalText;
  }

  /**
   * "Apply changes": push whatever the user has written in the MESSAGE-tab
   * editor into the live chat input, then briefly confirm on the button.
   */
  async function applyMessageEdits() {
    if (!msgApplyEl) return;
    await syncLiveInput();
    const orig = "Apply changes";
    msgApplyEl.textContent = "Applied \u2713";
    msgApplyEl.classList.add("guardai-panel__apply--done");
    clearTimeout(applyMessageEdits._t);
    applyMessageEdits._t = setTimeout(() => {
      if (!msgApplyEl) return;
      msgApplyEl.textContent = orig;
      msgApplyEl.classList.remove("guardai-panel__apply--done");
    }, 1400);
  }

  /* ---- Tabs, footer, send ---- */

  function setActiveTab(tab) {
    activeTab = tab === "message" ? "message" : "masked";
    if (!panelEl) return;
    panelEl.querySelectorAll(".guardai-panel__tab").forEach((t) => {
      t.classList.toggle(
        "guardai-panel__tab--active",
        t.getAttribute("data-tab") === activeTab
      );
    });
    panelEl.querySelectorAll(".guardai-panel__pane").forEach((p) => {
      p.classList.toggle(
        "guardai-panel__pane--active",
        p.getAttribute("data-pane") === activeTab
      );
    });
  }

  function updateFooter() {
    if (footerSendEl) footerSendEl.style.display = editMode ? "" : "none";
  }

  /** Send the (possibly edited) masked message from the MESSAGE tab. */
  async function panelSend() {
    const live = liveEditor();
    if (!live) {
      console.error("[GuardAI] No editor found to send from.");
      return;
    }
    let finalText = msgEditableEl ? msgEditableEl.innerText : "";
    finalText = finalText.replace(/\u00a0/g, " ").replace(/\s+$/, "");
    await typeText(live, finalText);
    state.lastMaskedText = finalText;
    // Snapshot review so the Message tab stays populated after the soft-nav
    // that follows a successful send (handleSoftNav clears `review` but not this).
    if (review) sentReview = review;
    editMode = false;
    updateFooter();
    msgHidePopup();
    live.focus();
    triggerSend(live);
  }

  /** Tear down the active review (after the user sends, or on navigation). */
  function clearReview() {
    msgHidePopup();
    dismissMaskPrompt();
    review = null;
    editMode = false;
    renderMessageTab();
    updateFooter();
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
    if (!state.enabled) return; // master off — no monitoring
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
        ".guardai-warning, .guardai-toast, .guardai-panel, .guardai-reopen, .guardai-msgtoggle, .guardai-review-pop, .guardai-prompt"
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

  /**
   * Decoration is decoupled from the (masker-gated, debounced) unmask pass so
   * that EVERY message gets its toggle button — including older messages that
   * mount only when the user scrolls up through a long (virtualised)
   * conversation. The observer and a capture-phase scroll listener both feed
   * this. It is independent of masker.size: a button is harmless on a message
   * with nothing to swap, and buildSwapRules reads the live mapping at click
   * time so it works the moment any data is masked.
   */
  let decorateTimer = null;
  function scheduleDecorate() {
    if (!state.enabled) return; // master off — no UI injection
    clearTimeout(decorateTimer);
    decorateTimer = setTimeout(async () => {
      if (!state.enabled) return;
      await masker.load();
      decorateMessages(findResponseRoot());
    }, 120);
  }

  /** Remove every piece of GuardAI UI we've injected into the page. */
  function teardownUI() {
    document
      .querySelectorAll(
        ".guardai-msgtoggle, .guardai-warning, .guardai-toast, .guardai-review-pop, .guardai-mark-tip"
      )
      .forEach((el) => el.remove());
    dismissMaskPrompt();
    if (panelEl) panelEl.style.display = "none";
    if (reopenEl) reopenEl.style.display = "none";
  }

  /**
   * React to the master on/off toggle flipping at runtime. Off -> strip all
   * injected UI and stop (the send listeners and observer callbacks already
   * short-circuit on !state.enabled). On -> resume a restore + decorate pass.
   */
  function applyEnabledState() {
    if (state.enabled) {
      scheduleUnmask();
      scheduleDecorate();
    } else {
      teardownUI();
    }
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

  const observer = new MutationObserver(() => {
    scheduleUnmask();
    scheduleDecorate();
  });

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
    // Decorate messages as the user scrolls: long conversations are virtualised,
    // so older messages only mount on scroll. Capture phase catches scrolling on
    // inner scroll containers (e.g. ChatGPT scrolls a div, not the window).
    window.addEventListener("scroll", scheduleDecorate, { capture: true, passive: true });
    // Initial pass in case a conversation with masked data is reloaded.
    scheduleUnmask();
    scheduleDecorate();
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
    dismissMaskPrompt();
    clearReview(); // a half-finished review doesn't belong in a new conversation
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
    scheduleDecorate();
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
