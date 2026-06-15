/**
 * GuardAI — detector.js
 * ---------------------------------------------------------------------------
 * Local-only sensitive-data detection engine. NO network calls, ever.
 *
 * Design principles (per the strict spec):
 *   - A number is only flagged as a SPECIFIC type if it matches that type's
 *     strict format (and, where relevant, passes a checksum).
 *   - Ambiguous patterns require CONTEXT words nearby before they are flagged,
 *     to keep false positives low.
 *   - High-confidence patterns (email, AU phone, Luhn-valid card, valid
 *     Medicare/TFN/ABN checksums, GPS) are flagged without context.
 *   - Overlapping matches are resolved (longest span wins) so the masker can
 *     splice cleanly.
 *
 * Region focus: Australia.
 *
 * A "finding" is:
 *   { type, label, value, index, severity: high|medium|low, reason }
 *
 * Exposed as window.GuardAI.Detector.
 * ---------------------------------------------------------------------------
 */
(function () {
  "use strict";

  /* ================================================================== *
   * Checksums & helpers
   * ================================================================== */

  /** Luhn — credit/debit cards. */
  function luhnValid(digits) {
    let sum = 0;
    let alt = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let n = parseInt(digits[i], 10);
      if (alt) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
      alt = !alt;
    }
    return sum % 10 === 0;
  }

  /** Australian Tax File Number checksum (8 or 9 digits, weighted, mod 11). */
  function tfnValid(digits) {
    const weights = [1, 4, 3, 7, 5, 8, 6, 9, 10];
    if (digits.length !== 8 && digits.length !== 9) return false;
    let sum = 0;
    for (let i = 0; i < digits.length; i++) sum += parseInt(digits[i], 10) * weights[i];
    return sum % 11 === 0;
  }

  /** Australian Medicare check digit (10 digits, first 2-6, 9th is checksum). */
  function medicareValid(digits) {
    if (digits.length < 10) return false;
    const first8 = digits.slice(0, 8);
    if (!/^[2-6]/.test(first8)) return false;
    const weights = [1, 3, 7, 9, 1, 3, 7, 9];
    let sum = 0;
    for (let i = 0; i < 8; i++) sum += parseInt(first8[i], 10) * weights[i];
    return sum % 10 === parseInt(digits[8], 10);
  }

  /** Australian Business Number checksum (11 digits, mod 89). */
  function abnValid(digits) {
    if (digits.length !== 11) return false;
    const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
    let sum = 0;
    for (let i = 0; i < 11; i++) {
      let n = parseInt(digits[i], 10);
      if (i === 0) n -= 1;
      sum += n * weights[i];
    }
    return sum % 89 === 0;
  }

  /** True if any of `words` appears within `win` chars around [start,end). */
  function near(text, start, end, words, win) {
    win = win || 30;
    const a = Math.max(0, start - win);
    const b = Math.min(text.length, end + win);
    const ctx = text.slice(a, b).toLowerCase();
    return words.some((w) => ctx.includes(w));
  }

  function dedupe(findings) {
    const seen = new Set();
    return findings.filter((f) => {
      const key = `${f.type}@${f.index}:${f.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /** Greedily keep the longest spans; drop anything overlapping an accepted one. */
  function resolveOverlaps(findings) {
    const sorted = [...findings].sort((a, b) => {
      if (b.value.length !== a.value.length) return b.value.length - a.value.length;
      return a.index - b.index;
    });
    const accepted = [];
    for (const f of sorted) {
      const s = f.index;
      const e = f.index + f.value.length;
      const clash = accepted.some((g) => s < g.index + g.value.length && e > g.index);
      if (!clash) accepted.push(f);
    }
    return accepted;
  }

  /* ================================================================== *
   * Plain-English risk explanations
   * ================================================================== */
  const REASONS = {
    NAME_PII:
      "A full name combined with another personal detail makes you directly identifiable.",
    DOB: "Your date of birth is a key identifier used to verify identity and is valuable for fraud.",
    PASSPORT:
      "Passport numbers are government identity documents and are extremely valuable to identity thieves.",
    LICENCE:
      "A driver licence number can be used to impersonate you and open accounts in your name.",
    MEDICARE:
      "Your Medicare number is sensitive government health ID and a prime target for identity theft.",
    TFN: "A Tax File Number is highly sensitive Australian government ID enabling serious identity fraud.",
    CREDIT_CARD:
      "Card numbers are financial credentials and should never appear in a chat log.",
    BSB: "A bank BSB identifies your branch and, with an account number, enables fraudulent transfers.",
    BANK_ACCOUNT:
      "Bank account details can be used to set up fraudulent debits or impersonate your bank.",
    MONEY:
      "A specific financial figure with business/personal context can be commercially or personally sensitive.",
    PHONE:
      "A phone number is tied to your identity and can be used for spam, SIM-swap or social engineering.",
    EMAIL:
      "An email address identifies you and links to your accounts; chats may be retained or used for training.",
    ADDRESS:
      "A home address reveals where you live — a physical-safety and stalking risk if it leaks.",
    GPS: "Precise GPS coordinates reveal an exact physical location and are a serious safety risk.",
    ABN: "An ABN identifies a specific business entity and links to commercial and tax records.",
    ACN: "An ACN identifies a registered company and links to official corporate records.",
    CONFIDENTIAL:
      "This content is marked confidential/restricted — sharing it may breach an NDA or policy.",
    BUSINESS_CONFIDENTIAL:
      "This looks like confidential business data (revenue, clients, internal figures) that could leak commercial secrets.",
    HEALTH:
      "Health and medical information is highly sensitive personal data and protected under privacy law.",
    LEGAL:
      "Legal or court information is confidential and could prejudice a matter or breach privilege.",
    IMMIGRATION:
      "Immigration/visa details are sensitive government records valuable for identity fraud.",
    PASSWORD:
      "This looks like a password or credential. Secrets must never be typed into an AI chat.",
  };

  const IDENTIFIER_TYPES = new Set([
    "PHONE",
    "EMAIL",
    "ADDRESS",
    "DOB",
    "MEDICARE",
    "TFN",
    "PASSPORT",
    "LICENCE",
    "CREDIT_CARD",
    "BANK_ACCOUNT",
    "BSB",
    "GPS",
    "ABN",
    "ACN",
  ]);

  function finding(type, label, value, index, severity) {
    return { type, label, value, index, severity, reason: REASONS[type] || "" };
  }

  /* ================================================================== *
   * Detectors
   * ================================================================== */

  // ---- Contact & location -------------------------------------------------
  function detectEmail(text, out) {
    const re = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    let m;
    while ((m = re.exec(text))) {
      out.push(finding("EMAIL", "Email address", m[0], m.index, "medium"));
    }
  }

  function detectPhone(text, out) {
    // 1) Standard AU: +61 / 61 / 0 prefix + 9 more digits in any separator layout.
    const re = /(?:\+?61|\b0)(?:[\s.-]?\d){9}\b/g;
    let m;
    while ((m = re.exec(text))) {
      const raw = m[0];
      const digits = raw.replace(/\D/g, "");
      let national;
      if (digits.startsWith("61")) {
        national = "0" + digits.slice(2);
      } else if (digits.startsWith("0")) {
        national = digits;
      } else {
        continue;
      }
      // Valid AU national number: exactly 10 digits, leading 0 then 2-9.
      if (national.length === 10 && /^0[2-9]\d{8}$/.test(national)) {
        out.push(finding("PHONE", "Phone number", raw.trim(), m.index, "medium"));
      }
    }

    // 2) AU service numbers: 1300 / 1800 / 1900 XXXXXX (10 digits).
    const serviceRe = /\b(1[389]00[\s.-]?\d{3}[\s.-]?\d{3})\b/g;
    while ((m = serviceRe.exec(text))) {
      out.push(finding("PHONE", "Phone number", m[1].trim(), m.index, "medium"));
    }

    // 3) Context-triggered: any 7–12 digit number near phone keywords — catches
    //    unusual formats (e.g. "1414 376 274"), international numbers, or numbers
    //    the user explicitly labels as a phone/mobile/contact number.
    const PHONE_CTX = [
      "phone", "mobile", "cell", "call me", "contact", "number is",
      "reach me", "ring", "text me", "sms", "fax",
    ];
    const ctxRe = /\b(\d[\d\s.\-()\[\]]{5,18}\d)\b/g;
    while ((m = ctxRe.exec(text))) {
      const digits = m[1].replace(/\D/g, "");
      if (digits.length < 7 || digits.length > 12) continue;
      // Skip anything already captured as a phone.
      const start = m.index;
      const end = start + m[1].length;
      if (out.some((f) => f.type === "PHONE" && f.index <= start && end <= f.index + f.value.length))
        continue;
      if (near(text, start, end, PHONE_CTX, 45)) {
        out.push(finding("PHONE", "Phone number", m[1].trim(), start, "medium"));
      }
    }
  }

  function detectGPS(text, out) {
    const re = /[-+]?\d{1,2}\.\d{4,}\s*,\s*[-+]?\d{2,3}\.\d{4,}/g;
    let m;
    while ((m = re.exec(text))) {
      out.push(finding("GPS", "GPS coordinates", m[0].trim(), m.index, "high"));
    }
  }

  function detectAddress(text, out) {
    const streetTypes =
      "St|Street|Rd|Road|Ave|Avenue|Dr|Drive|Ln|Lane|Ct|Court|Pl|Place|Cres|Crescent|Blvd|Boulevard|Hwy|Highway|Pde|Parade|Tce|Terrace|Way|Cl|Close";
    const states = "NSW|VIC|QLD|WA|SA|TAS|ACT|NT";
    // number + 1-3 capitalised words + street type, optional ", suburb", state, postcode.
    const re = new RegExp(
      `\\b(\\d{1,5}[A-Za-z]?(?:[-/]\\d{1,4})?\\s+(?:[A-Z][a-zA-Z]+\\s+){1,3}(?:${streetTypes})\\b\\.?` +
        `(?:,?\\s+[A-Z][a-zA-Z]+){0,2}(?:\\s+(?:${states}))?(?:\\s+\\d{4})?)`,
      "g"
    );
    let m;
    while ((m = re.exec(text))) {
      out.push(finding("ADDRESS", "Physical address", m[1].trim(), m.index, "high"));
    }
  }

  // ---- Financial ----------------------------------------------------------
  function detectCreditCard(text, out) {
    const re = /\b(?:\d[ -]?){13,19}\b/g;
    let m;
    while ((m = re.exec(text))) {
      const digits = m[0].replace(/\D/g, "");
      if (digits.length >= 13 && digits.length <= 19 && luhnValid(digits)) {
        out.push(
          finding("CREDIT_CARD", "Credit/debit card number", m[0].trim(), m.index, "high")
        );
      }
    }
  }

  function detectBSB(text, out) {
    // Strictly XXX-XXX with a dash.
    const re = /\b\d{3}-\d{3}\b/g;
    let m;
    while ((m = re.exec(text))) {
      const ctx = near(text, m.index, re.lastIndex, ["bsb", "bank", "branch", "account", "acct"], 25);
      out.push(finding("BSB", "Bank BSB", m[0], m.index, ctx ? "high" : "medium"));
    }
  }

  function detectBankAccount(text, out) {
    // 6-10 digit account number, but only near banking context words.
    const re = /\b\d{6,10}\b/g;
    let m;
    while ((m = re.exec(text))) {
      if (
        near(text, m.index, re.lastIndex, ["account", "acct", "a/c", "bsb", "bank", "savings", "transfer"], 25)
      ) {
        out.push(finding("BANK_ACCOUNT", "Bank account number", m[0], m.index, "high"));
      }
    }
  }

  function detectMoney(text, out) {
    // Standard comma-formatted or bare 4+ digit dollar amounts (context required).
    const re = /\$\s?\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\$\s?\d{4,}(?:\.\d{1,2})?/g;
    const ctx = [
      "salary", "revenue", "profit", "invoice", "payment", "income", "wage",
      "turnover", "earn", "paid", "bonus", "valuation", "fee",
    ];
    let m;
    while ((m = re.exec(text))) {
      const val = parseFloat(m[0].replace(/[^0-9.]/g, ""));
      if (val > 1000 && near(text, m.index, re.lastIndex, ctx, 40)) {
        out.push(finding("MONEY", "Financial amount", m[0].trim(), m.index, "medium"));
      }
    }
    // Verbal multipliers: $2.4 million / $1.2 billion — always significant, no
    // context check needed.
    const reVerbal = /\$\s?\d+(?:\.\d+)?\s*(?:million|billion|trillion)\b/gi;
    while ((m = reVerbal.exec(text))) {
      out.push(finding("MONEY", "Financial amount", m[0].trim(), m.index, "medium"));
    }
  }

  // ---- Personal identity --------------------------------------------------
  function detectMedicare(text, out) {
    const re = /\b([2-6]\d{3})[\s-]?(\d{5})[\s-]?(\d)(?:[\s/-]?(\d))?\b/g;
    let m;
    while ((m = re.exec(text))) {
      const digits = (m[1] + m[2] + m[3]).replace(/\D/g, "");
      if (medicareValid(digits)) {
        out.push(finding("MEDICARE", "Medicare number", m[0].trim(), m.index, "high"));
      }
    }
  }

  function detectTFN(text, out) {
    const re = /\b(\d{3})[\s-]?(\d{3})[\s-]?(\d{2,3})\b/g;
    let m;
    while ((m = re.exec(text))) {
      const digits = (m[1] + m[2] + m[3]).replace(/\D/g, "");
      if ((digits.length === 8 || digits.length === 9) && tfnValid(digits)) {
        const hasCtx = near(text, m.index, re.lastIndex, ["tfn", "tax file"], 20);
        const hasSep = /[\s-]/.test(m[0]);
        if (hasCtx || hasSep) {
          out.push(finding("TFN", "Tax File Number", m[0].trim(), m.index, "high"));
        }
      }
    }
  }

  function detectPassport(text, out) {
    // AU passports: 1-2 letters + 7-8 digits (the strict format).
    const re = /\b([A-Z]{1,2}\d{7,8})\b/g;
    let m;
    while ((m = re.exec(text))) {
      out.push(finding("PASSPORT", "Passport number", m[1], m.index, "high"));
    }
  }

  function detectLicence(text, out) {
    // State licence formats vary, so require an explicit licence keyword.
    const re =
      /\b(?:driver'?s?\s*licen[cs]e|licen[cs]e\s*(?:no\.?|number|#)?)\s*[:#]?\s*([A-Z0-9]{6,9})\b/gi;
    let m;
    while ((m = re.exec(text))) {
      out.push(finding("LICENCE", "Driver licence number", m[1], m.index, "high"));
    }
  }

  function detectDOB(text, out) {
    const months =
      "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?";
    const written = new RegExp(
      `\\b(0?[1-9]|[12]\\d|3[01])(?:st|nd|rd|th)?\\s+(?:${months})\\.?\\s+(?:19|20)\\d\\d\\b`,
      "gi"
    );
    const numeric = /\b(0?[1-9]|[12]\d|3[01])[\/.-](0?[1-9]|1[0-2])[\/.-](?:19|20)\d\d\b/g;
    const ctx = ["born", "dob", "d.o.b", "date of birth", "birthday", "birthdate", "b-day"];
    for (const re of [written, numeric]) {
      let m;
      while ((m = re.exec(text))) {
        if (near(text, m.index, m.index + m[0].length, ctx, 25)) {
          out.push(finding("DOB", "Date of birth", m[0].trim(), m.index, "medium"));
        }
      }
    }
  }

  // ---- Business -----------------------------------------------------------
  function detectABN(text, out) {
    const re = /\b(\d{2})\s?(\d{3})\s?(\d{3})\s?(\d{3})\b/g;
    let m;
    while ((m = re.exec(text))) {
      const digits = m[1] + m[2] + m[3] + m[4];
      const hasCtx = near(text, m.index, re.lastIndex, ["abn"], 15);
      if (abnValid(digits) || hasCtx) {
        out.push(finding("ABN", "Australian Business Number", m[0].trim(), m.index, "medium"));
      }
    }
  }

  function detectACN(text, out) {
    const re = /\b(\d{3})\s?(\d{3})\s?(\d{3})\b/g;
    let m;
    while ((m = re.exec(text))) {
      if (near(text, m.index, re.lastIndex, ["acn", "company number"], 15)) {
        out.push(finding("ACN", "Australian Company Number", m[0].trim(), m.index, "medium"));
      }
    }
  }

  function detectBusiness(text, out) {
    const re =
      /\b(?:annual\s+)?(?:revenue|turnover|arr|mrr|profit|ebitda|valuation|gross margin|net income|client list|customer list)\b[^.\n]{0,40}/gi;
    let m;
    while ((m = re.exec(text))) {
      out.push(
        finding("BUSINESS_CONFIDENTIAL", "Confidential business data", m[0].trim(), m.index, "medium")
      );
    }
  }

  function detectConfidential(text, out) {
    const re =
      /\b(confidential|do not (?:share|forward|distribute)|internal use only|internal only|private and confidential|non-disclosure|nda|proprietary|classified|not for distribution)\b/gi;
    let m;
    while ((m = re.exec(text))) {
      out.push(finding("CONFIDENTIAL", "Confidential / restricted", m[0], m.index, "medium"));
    }
  }

  // ---- Health & sensitive personal ---------------------------------------
  function detectHealth(text, out) {
    const re =
      /\b(medicare(?:\s*(?:card|number))?|diagnos(?:ed|is)|prescrib(?:ed|tion)|prescription|medication|dosage|\d+\s?mg\b|symptoms?|cancer|diabet(?:es|ic)|depression|anxiety|bipolar|schizophreni\w*|hiv|aids|pregnan\w*|chemotherapy|therapy|psychiatr\w*|mental health|blood test|medical (?:record|history|condition))\b/gi;
    let m;
    while ((m = re.exec(text))) {
      out.push(finding("HEALTH", "Health / medical information", m[0], m.index, "medium"));
    }
  }

  function detectLegal(text, out) {
    const re =
      /\b(lawsuit|litigation|court (?:case|order|reference)|case\s*(?:no\.?|number)\s*[:#]?\s*[A-Z0-9][A-Z0-9\/-]{2,}|settlement agreement|legal proceedings|subpoena|plaintiff|defendant)\b/gi;
    let m;
    while ((m = re.exec(text))) {
      out.push(finding("LEGAL", "Legal / court information", m[0].trim(), m.index, "medium"));
    }
  }

  function detectImmigration(text, out) {
    const re =
      /\b(visa\s*subclass\s*\d{3}|subclass\s*\d{3}|visa(?:\s*(?:application|status|number))?|immigration|permanent residency|work permit|bridging visa|citizenship application|sponsorship|green card)\b/gi;
    let m;
    while ((m = re.exec(text))) {
      out.push(finding("IMMIGRATION", "Immigration / visa details", m[0].trim(), m.index, "medium"));
    }
  }

  // ---- Passwords & credentials -------------------------------------------
  function detectPassword(text, out) {
    // Context-driven: "password is ...", "api key: ...", etc.
    const re =
      /\b(?:password|passwd|pwd|passcode|pass(?:phrase)?|login|credentials?|api[\s_-]?key|secret(?:\s*key)?|token|auth)\b\s*(?:is|=|:)\s*(\S{4,})/gi;
    let m;
    while ((m = re.exec(text))) {
      const secret = m[1].replace(/[.,;:!?]+$/, "");
      const idx = m.index + m[0].indexOf(m[1]);
      out.push(finding("PASSWORD", "Password / credential", secret, idx, "high"));
    }

    // Standalone strong-password-looking tokens (mixed case + digit + symbol).
    const tokRe = /(?:^|\s)(\S{8,64})/g;
    let t;
    while ((t = tokRe.exec(text))) {
      const tok = t[1].replace(/[.,;:!?]+$/, "");
      if (/^https?:\/\//i.test(tok) || tok.includes("@") || tok.includes("/")) continue;
      if (
        /[a-z]/.test(tok) &&
        /[A-Z]/.test(tok) &&
        /\d/.test(tok) &&
        /[^A-Za-z0-9]/.test(tok)
      ) {
        const idx = t.index + t[0].indexOf(tok);
        out.push(finding("PASSWORD", "Possible password", tok, idx, "high"));
      }
    }
  }

  // ---- Names (only with another identifier) ------------------------------
  // Identifier / category keywords that must never be read as a name. If either
  // word of a candidate "First Last" pair is one of these (e.g. "Her Medicare",
  // "My TFN", "His Licence"), it's a reference to an identifier, not a person.
  const NAME_CONTEXT_WORDS = new Set([
    "medicare", "tfn", "abn", "acn", "bsb", "licence", "license", "passport",
    "visa", "ssn", "pension", "centrelink", "ndis", "ihi", "ahpra",
    "number", "card", "id", "identifier",
    // Corporate suffixes — prevent "Acme Corp" / "Pacific Ltd" matching as a person name.
    "corp", "corporation", "inc", "incorporated", "ltd", "limited", "pty",
    "plc", "llc", "llp", "lp", "group", "holdings", "partners", "associates",
    "solutions", "services", "industries", "technologies", "enterprises",
    "consulting", "management", "financial", "capital", "ventures", "global",
  ]);
  // Explicit self-introduction phrases that make a capitalised word pair a clear
  // name even when no other identifier is present in the message.
  const NAME_INTRO_PHRASES = [
    "my name is", "name is", "i am", "i'm", "im ", "call me", "i'm called",
    "my name's", "this is", "i go by",
  ];

  function detectNames(text, out, hasIdentifier) {
    // Also detect when the user explicitly introduces themselves, even in a short
    // message with no other identifier (e.g. "my name is John Smith").
    const lc = text.toLowerCase();
    const hasNameCtx = NAME_INTRO_PHRASES.some((p) => lc.includes(p));
    if (!hasIdentifier && !hasNameCtx) return;
    const re = /\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/g;
    const STOPWORDS = new Set([
      "Hi", "Hello", "Dear", "Thanks", "Thank", "Kind", "Best", "The", "This",
      "That", "My", "Please", "Could", "Would", "Should", "Date", "Tax", "File",
      "Her", "His", "Their", "Our", "Your", "Its",
    ]);
    let m;
    while ((m = re.exec(text))) {
      if (STOPWORDS.has(m[1])) continue;
      // Skip if either token is an identifier/category keyword.
      if (
        NAME_CONTEXT_WORDS.has(m[1].toLowerCase()) ||
        NAME_CONTEXT_WORDS.has(m[2].toLowerCase())
      ) {
        continue;
      }
      out.push(finding("NAME_PII", "Full name (with other PII)", m[0], m.index, "medium"));
    }
  }

  /* ================================================================== *
   * Public class
   * ================================================================== */
  class Detector {
    scan(text) {
      if (!text || typeof text !== "string") return [];
      const out = [];

      // High-confidence structured detectors first.
      detectCreditCard(text, out);
      detectMedicare(text, out);
      detectTFN(text, out);
      detectABN(text, out);
      detectACN(text, out);
      detectPassport(text, out);
      detectLicence(text, out);
      detectBSB(text, out);
      detectBankAccount(text, out);
      detectGPS(text, out);
      detectEmail(text, out);
      detectPhone(text, out);
      detectAddress(text, out);
      detectDOB(text, out);
      detectMoney(text, out);

      // Keyword / contextual detectors.
      detectConfidential(text, out);
      detectBusiness(text, out);
      detectHealth(text, out);
      detectLegal(text, out);
      detectImmigration(text, out);
      detectPassword(text, out);

      // Names: only when another identifier (or banking context) is present.
      const hasIdentifier =
        out.some((f) => IDENTIFIER_TYPES.has(f.type)) ||
        /\b(bank|account holder|savings account)\b/i.test(text);
      detectNames(text, out, hasIdentifier);

      return resolveOverlaps(dedupe(out)).sort((a, b) => a.index - b.index);
    }

    hasSensitive(text) {
      return this.scan(text).length > 0;
    }
  }

  window.GuardAI = window.GuardAI || {};
  window.GuardAI.Detector = Detector;
  window.GuardAI.REASONS = REASONS;
})();
