/**
 * GuardAI — masker.js
 * ---------------------------------------------------------------------------
 * Reversible data masking ("encrypt before sending").
 *
 * The masker swaps real sensitive values for realistic, region-appropriate
 * (Australian) FAKE values before a message is sent to an AI, and swaps them
 * back when the AI responds.
 *
 * It is NOT cryptographic encryption — by design (per spec). Instead it keeps
 * a simple bidirectional lookup table:
 *
 *     real value  <-->  fake value
 *
 * The table is persisted to chrome.storage.local ONLY. It is never synced,
 * never sent anywhere. The same real value always maps to the same fake value
 * within the lifetime of the table, so conversations stay coherent.
 *
 * Exposed as window.GuardAI.Masker.
 * ---------------------------------------------------------------------------
 */
(function () {
  "use strict";

  const STORAGE_KEY = "guardai_mapping";

  /* ------------------------------------------------------------------ *
   * Australian-flavoured fake-data pools.
   * ------------------------------------------------------------------ */
  const FIRST_NAMES = [
    "David", "Emma", "Liam", "Olivia", "Noah", "Ava", "Jack", "Mia",
    "Lucas", "Chloe", "Ethan", "Grace", "Oliver", "Sophie", "Henry", "Ruby",
  ];
  const LAST_NAMES = [
    "Clarke", "Walker", "Bennett", "Hughes", "Foster", "Reid", "Murphy",
    "Marshall", "Coleman", "Newman", "Dawson", "Fletcher", "Barker", "Wells",
  ];
  const STREET_NAMES = [
    "Oak", "Maple", "Cedar", "Birch", "Elm", "Willow", "Acacia", "Banksia",
    "Wattle", "Jacaranda", "Eucalypt", "Hibiscus",
  ];
  const STREET_TYPES = ["Ave", "St", "Rd", "Cres", "Pde", "Ct", "Dr"];
  const CITIES = [
    "Melbourne", "Brisbane", "Perth", "Adelaide", "Hobart", "Canberra",
    "Newcastle", "Geelong", "Cairns", "Darwin",
  ];
  const EMAIL_DOMAINS = ["placeholder.com", "example.com.au", "sample.net"];
  const COMPANIES = [
    "Acme Holdings", "Northwind Pty Ltd", "Riverstone Group", "BlueGum Co",
    "Summit Partners", "Harbourview Ltd",
  ];

  /* ------------------------------------------------------------------ *
   * Seeded pseudo-random helpers. The seed is random per generated value, so
   * fakes are fresh each time; the lookup table keeps a real value mapped to
   * the same fake for the life of the table so conversations stay coherent.
   * ------------------------------------------------------------------ */
  function pick(arr, seed) {
    // seed can exceed 2^31; coerce to a safe non-negative index.
    const i = ((seed >>> 0) % arr.length + arr.length) % arr.length;
    return arr[i];
  }

  function seededDigits(seed, length) {
    // Generate `length` digits deterministically from a seed.
    let s = seed || 1;
    let out = "";
    for (let i = 0; i < length; i++) {
      s = (Math.imul(s, 1103515245) + 12345) >>> 0;
      out += ((s >>> 16) % 10).toString();
    }
    return out;
  }

  /** Build a Luhn-valid fake card number from a seed. */
  function fakeCard(seed) {
    let body = "4" + seededDigits(seed, 14); // 15 digits, Visa-like prefix
    // Compute Luhn check digit for the 16th position.
    let sum = 0;
    let alt = true;
    for (let i = body.length - 1; i >= 0; i--) {
      let n = parseInt(body[i], 10);
      if (alt) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
      alt = !alt;
    }
    const check = (10 - (sum % 10)) % 10;
    const full = body + check;
    return full.replace(/(\d{4})(?=\d)/g, "$1 ");
  }

  /** A fresh 32-bit random seed. Using randomness (not a hash of the real
   * value) means every masked value is a brand-new random Australian identity
   * each time — we never reproduce a fixed "Mia Murphy" for a given input.
   * Consistency within a session is provided by the lookup table, not the seed. */
  function randomSeed() {
    return (Math.random() * 0x100000000) >>> 0;
  }

  /* ------------------------------------------------------------------ *
   * Fake-value generators per finding type. Each takes the real value (only
   * used for structural hints like length) plus a RANDOM seed, and returns a
   * realistic Australian substitute.
   * ------------------------------------------------------------------ */
  const GENERATORS = {
    EMAIL(real, seed) {
      const first = pick(FIRST_NAMES, seed).toLowerCase();
      const last = pick(LAST_NAMES, seed >>> 7).toLowerCase();
      const domain = pick(EMAIL_DOMAINS, seed >>> 3);
      const num = (seed >>> 11) % 100;
      return `${first}.${last}${num}@${domain}`;
    },
    PHONE(real, seed) {
      const d = seededDigits(seed, 8);
      return `04${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)}`;
    },
    CREDIT_CARD(real, seed) {
      return fakeCard(seed);
    },
    MEDICARE(real, seed) {
      const d = seededDigits(seed, 10);
      return `2${d.slice(0, 3)} ${d.slice(3, 8)} ${d.slice(8, 9)}`;
    },
    TFN(real, seed) {
      const d = seededDigits(seed, 9);
      return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 9)}`;
    },
    PASSPORT(real, seed) {
      const letter = String.fromCharCode(65 + (seed % 26));
      return `${letter}${seededDigits(seed, 7)}`;
    },
    LICENCE(real, seed) {
      return seededDigits(seed, 8);
    },
    BSB(real, seed) {
      const d = seededDigits(seed, 6);
      return `${d.slice(0, 3)}-${d.slice(3, 6)}`;
    },
    BANK_ACCOUNT(real, seed) {
      return seededDigits(seed, real.replace(/\D/g, "").length || 8);
    },
    ABN(real, seed) {
      const d = seededDigits(seed, 11);
      return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8, 11)}`;
    },
    ACN(real, seed) {
      const d = seededDigits(seed, 9);
      return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 9)}`;
    },
    DOB(real, seed) {
      const day = (seed % 28) + 1;
      const month = ((seed >>> 5) % 12) + 1;
      const year = 1960 + ((seed >>> 9) % 45); // 1960-2004
      const pad = (n) => String(n).padStart(2, "0");
      return `${pad(day)}/${pad(month)}/${year}`;
    },
    GPS(real, seed) {
      const lat = -(33 + ((seed % 400) / 100)).toFixed(4); // ~-33 to -37
      const lng = (144 + (((seed >>> 7) % 700) / 100)).toFixed(4); // ~144 to 151
      return `${lat}, ${lng}`;
    },
    MONEY(real, seed) {
      const amount = 1000 + (seed % 99000);
      return "$" + amount.toLocaleString("en-AU");
    },
    ADDRESS(real, seed) {
      const num = (seed % 200) + 1;
      const street = pick(STREET_NAMES, seed >>> 2);
      const type = pick(STREET_TYPES, seed >>> 4);
      const city = pick(CITIES, seed >>> 6);
      return `${num} ${street} ${type} ${city}`;
    },
    PASSWORD() {
      // Never preserve any structure of a real secret — return a generic token.
      return "[redacted-secret]";
    },
    NAME_PII(real, seed) {
      return `${pick(FIRST_NAMES, seed)} ${pick(LAST_NAMES, seed >>> 3)}`;
    },
  };

  /**
   * Only these types are MASKED (swapped for fakes). Keyword/contextual
   * findings (CONFIDENTIAL, HEALTH, LEGAL, IMMIGRATION, BUSINESS_CONFIDENTIAL)
   * are warning-only — replacing free-text phrases would mangle the message.
   */
  const MASKABLE = new Set([
    "NAME_PII", "DOB", "PASSPORT", "LICENCE", "MEDICARE", "TFN", "CREDIT_CARD",
    "BSB", "BANK_ACCOUNT", "MONEY", "PHONE", "EMAIL", "ADDRESS", "GPS", "ABN",
    "ACN", "PASSWORD",
  ]);

  function generateFake(type, real) {
    const gen = GENERATORS[type] || (() => "[redacted]");
    return gen(real, randomSeed());
  }

  /* ------------------------------------------------------------------ *
   * Masker class
   * ------------------------------------------------------------------ */
  class Masker {
    constructor() {
      // In-memory mirrors of the persisted table for fast sync lookups.
      this.realToFake = new Map();
      this.fakeToReal = new Map();
      this._loaded = false;
    }

    /** Load the persisted mapping table from chrome.storage.local. */
    async load() {
      if (this._loaded) return;
      const data = await chrome.storage.local.get(STORAGE_KEY);
      const entries = data[STORAGE_KEY] || [];
      for (const e of entries) {
        this.realToFake.set(e.real, e);
        this.fakeToReal.set(e.fake, e);
      }
      this._loaded = true;
    }

    /** Persist the in-memory table back to chrome.storage.local. */
    async save() {
      const entries = Array.from(this.realToFake.values());
      await chrome.storage.local.set({ [STORAGE_KEY]: entries });
    }

    /** Get an existing fake for a real value, or create + remember one. */
    _getOrCreate(type, real) {
      const existing = this.realToFake.get(real);
      if (existing) return existing.fake;

      let fake = generateFake(type, real);
      // Guarantee uniqueness of the fake value so unmasking is unambiguous.
      let guard = 0;
      while (this.fakeToReal.has(fake) && guard < 50) {
        fake = generateFake(type, real + ":" + guard);
        guard++;
      }
      const entry = { real, fake, type, createdAt: Date.now() };
      this.realToFake.set(real, entry);
      this.fakeToReal.set(fake, entry);
      return fake;
    }

    /** Is this finding type one we swap for a fake (vs warning-only)? */
    isMaskable(type) {
      return MASKABLE.has(type);
    }

    /**
     * Compute a candidate fake for a value WITHOUT registering it. Used by the
     * pre-send preview so we can show the proposed replacement before the user
     * commits. Reuses an existing mapping if one is already known, and avoids
     * collisions with fakes that are already in the table.
     */
    previewFake(type, real) {
      const existing = this.realToFake.get(real);
      if (existing) return existing.fake;
      let fake = generateFake(type, real);
      let guard = 0;
      while (this.fakeToReal.has(fake) && guard < 50) {
        fake = generateFake(type, real + ":" + guard);
        guard++;
      }
      return fake;
    }

    /**
     * Register a real->fake pair the user committed in the preview (either an
     * auto-generated or a custom replacement). Reuses an existing mapping for
     * the same real value. Caller is responsible for calling save().
     */
    registerManual(real, fake, type) {
      const existing = this.realToFake.get(real);
      if (existing) return existing.fake;
      const entry = { real, fake, type: type || "CUSTOM", createdAt: Date.now() };
      this.realToFake.set(real, entry);
      this.fakeToReal.set(fake, entry);
      return fake;
    }

    /**
     * Mask text given pre-computed findings from the detector.
     * Returns { masked, replacements } where replacements lists what changed.
     * Replacements are applied from the end of the string backwards so that
     * earlier indices stay valid as the string length changes.
     */
    async mask(text, findings) {
      await this.load();
      if (!findings || !findings.length) return { masked: text, replacements: [] };

      // Only swap maskable (structured) findings; leave warning-only ones intact.
      const maskable = findings.filter((f) => MASKABLE.has(f.type));
      if (!maskable.length) return { masked: text, replacements: [] };

      // Sort by index descending to keep offsets valid during splicing.
      const ordered = [...maskable].sort((a, b) => b.index - a.index);
      let masked = text;
      const replacements = [];

      for (const f of ordered) {
        const fake = this._getOrCreate(f.type, f.value);
        const start = f.index;
        const end = start + f.value.length;
        // Defensive: only splice if the slice still matches the finding value.
        if (masked.slice(start, end) === f.value) {
          masked = masked.slice(0, start) + fake + masked.slice(end);
        } else {
          // Fallback to a global replace if offsets drifted (rich editors).
          masked = masked.split(f.value).join(fake);
        }
        replacements.push({ type: f.type, real: f.value, fake });
      }

      await this.save();
      return { masked, replacements };
    }

    /**
     * Reverse the masking: swap every known fake value back to its real value.
     * Used on AI responses (and the user's own sent bubbles) so the user only
     * ever reads real data. Longest fakes first to avoid partial overlaps.
     */
    async unmask(text) {
      await this.load();
      if (!text || this.fakeToReal.size === 0) return text;

      const fakes = Array.from(this.fakeToReal.keys()).sort(
        (a, b) => b.length - a.length
      );
      let result = text;
      for (const fake of fakes) {
        if (result.includes(fake)) {
          const entry = this.fakeToReal.get(fake);
          result = result.split(fake).join(entry.real);
        }
      }
      return result;
    }

    /** Does the given text contain any known fake placeholder? */
    async containsFake(text) {
      await this.load();
      for (const fake of this.fakeToReal.keys()) {
        if (text.includes(fake)) return true;
      }
      return false;
    }

    /** Wipe the entire mapping table (memory + storage). */
    async clear() {
      this.realToFake.clear();
      this.fakeToReal.clear();
      await chrome.storage.local.remove(STORAGE_KEY);
    }

    /** Number of stored mappings. */
    get size() {
      return this.realToFake.size;
    }
  }

  window.GuardAI = window.GuardAI || {};
  window.GuardAI.Masker = Masker;
})();
