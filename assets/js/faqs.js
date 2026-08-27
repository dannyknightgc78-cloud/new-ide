/**
 * @license
 * Copyright (c) 2026 Haven // Your Sanctuary. All rights reserved.
 *
 * NOTICE: All information contained herein is, and remains the property of
 * Haven and its suppliers, if any. The intellectual and technical concepts
 * contained herein are proprietary to Haven and its suppliers and may be
 * covered by Spanish and international patents, patents in process, and are
 * protected by trade secret or copyright law.
 *
 * Dissemination of this information or reproduction of this material is
 * strictly forbidden unless prior written permission is obtained from Haven.
 *
 * Verification Token Hash: ED25519_CORE_SECURITY_ENFORCED
 */

/* ============================================================
   Haven — FAQ knowledge base (static, no LLM).

   Shared by assist.js (setup/FAQ widget) and contact.js (landing chat).
   Match user prompts with simple keyword scoring; on miss, direct to Contact.
   ============================================================ */
(function (global) {
  "use strict";

  var CONTACT_REDIRECT =
    "I don't have that in our FAQ yet";

  var HUMAN_INTENT = [
    "speak to", "talk to", "call me", "human", "person", "agent", "support team",
    "contact", "email you", "get in touch", "representative", "someone", "help me with my account",
    "refund", "complaint", "bug report", "broken", "not working for me", "real person", "respond",
    "legal", "lawyer", "sue", "court", "gdpr", "privacy complaint"
  ];

  var FAQS = [
    {
      id: "what-is-haven",
      keywords: ["what is haven", "what does haven", "haven do", "about haven", "purpose", "product"],
      answer:
        "Haven is a privacy-first family digital sanctuary — mentor, not monitor. " +
        "It blocks ads and trackers, guards an encrypted password vault, and sends proof-of-integrity check-ins. " +
        "It never reads messages, photos, or browsing history."
    },
    {
      id: "setup",
      keywords: ["setup", "set up", "getting started", "onboard", "first time", "from scratch", "walkthrough"],
      answer:
        "Four steps (full guide at setup.html): (1) Create your account on the pricing page — Single Child/Device, " +
        "Family Haven, or Sovereign Gold via Stripe checkout. (2) Portal Admin → Add a device → enter the " +
        "enrolment code on the device you want to protect. (3) Install the Haven Family browser extension from downloads.html; " +
        "add Haven to the home screen on phones. (4) Confirm green Verified status in the Portal Admin Chain of Trust."
    },
    {
      id: "install",
      keywords: ["install", "download", "zip", "unzip", "mac install", "how to install", "load unpacked"],
      answer:
        "Downloads: haven.dannygc.cloud/downloads.html. Mac Chrome/Edge: unzip, double-click Install Haven.command, " +
        "follow the wizard, click Confirm setup, choose Free tier or paste ABXLIC1. " +
        "iPhone/iPad: Safari → Add to Home Screen. Android: download haven-family-android.apk (v0.1.0 launcher) or Chrome → Install app. Each zip includes README_INSTALL.md."
    },
    {
      id: "pricing",
      keywords: ["price", "pricing", "cost", "plan", "subscription", "how much", "tier", "solo", "single child", "family", "sovereign gold", "sovereign"],
      answer:
        "Three plans: Single Child/Device — €4.99/mo, 1 device. Family Haven — €9.99/mo, up to 5 devices. " +
        "Sovereign Gold — €49.99/year, annual self-host licence + installer bundle, unlimited devices on your hardware. " +
        "See Pricing on the home page."
    },
    {
      id: "privacy",
      keywords: ["privacy", "read messages", "spy", "surveillance", "photos", "browsing", "data", "content"],
      answer:
        "No — Haven cannot read messages, photos, or browsing. It runs locally on the device: " +
        "ad blocking, encrypted vault, and integrity check-ins only. We hold the proof, not your data."
    },
    {
      id: "failsafe-keys",
      keywords: ["failsafe", "failsafe-keys", "haven-failsafe", "key file", "false flag", "offline lock", "reset", "network adapter", "recovery"],
      answer:
        "During setup, download haven-failsafe-keys.json and store it on an external drive or admin-only device — " +
        "not on the device being protected. This encrypted recovery file is yours alone; Haven never keeps a cloud copy."
    },
    {
      id: "keys-storage",
      keywords: ["keys", "stored", "where is data", "who holds", "local", "hardware", "ed25519"],
      answer:
        "Haven is local-first. Your data and signing keys stay on your hardware. Integrity records use Ed25519 proofs — " +
        "hash-chained and tamper-evident, like a seal that shows if anything was altered."
    },
    {
      id: "devices",
      keywords: ["device", "another device", "add device", "second device", "ipad", "phone", "limit", "enrol", "enroll"],
      answer:
        "Portal Admin → Add a device, enter the enrolment code on the new device. Limits: " +
        "Single Child/Device = 1, Family Haven = up to 5, Sovereign Gold = unlimited on self-hosted hardware. Upgrade anytime from Ops or Pricing."
    },
    {
      id: "browsers",
      keywords: ["browser", "chrome", "safari", "firefox", "edge", "iphone", "ipad", "android", "works on", "platform"],
      answer:
        "Portal Admin works in all current browsers. On each device: Mac — Haven Family extension " +
        "(zip + load unpacked if needed) or Safari via Xcode build. iPhone/iPad — Add haven.dannygc.cloud to Home Screen. " +
        "Android — APK launcher (haven-family-android.apk), Chrome PWA install, or load the Chrome extension unpacked."
    },
    {
      id: "payments",
      keywords: ["payment", "pay", "card", "apple pay", "stripe", "secure", "cancel", "subscription", "pci"],
      answer:
        "Payments are handled entirely by Stripe on their secure checkout page. Haven never stores your card or " +
        "Apple Pay details — we never see them. All plans are subscriptions — cancel or manage auto-renew anytime."
    },
    {
      id: "proof-integrity",
      keywords: ["proof", "integrity", "ledger", "chain", "tamper", "notary", "cryptographic", "verify", "verified", "chain of trust"],
      answer:
        "Haven uses Ed25519-signed integrity proofs (Chain of Trust). Each check-in is tamper-evident — " +
        "altering past records breaks the chain. Green Verified in Portal Admin means protection is working."
    },
    {
      id: "visible-mentor",
      keywords: ["mentor", "monitor", "child know", "transparent", "covert", "stealth", "visible"],
      answer:
        "Haven is a Digital Mentor, not a monitor. Your child knows Haven is present — rules are visible and " +
        "protection is transparent. You see verified safety hours, not a feed of private content."
    },
    {
      id: "extensions",
      keywords: ["extension", "guard", "monitored browser", "haven guard", "chrome extension"],
      answer:
        "Protection uses the Haven Family browser extension from downloads.html — runs locally, blocks ads/trackers, " +
        "guards your vault. Portal Admin manages enrolled household devices. Each zip includes README_INSTALL.md."
    },
    {
      id: "ops-center",
      keywords: ["ops", "portal admin", "admin ops", "dashboard", "control", "killswitch", "lock", "emergency", "lockdown", "fleet"],
      answer:
        "The Portal Admin (ops.html) is your household dashboard: device status, Chain of Trust, " +
        "signed commands, and Emergency Internet Lock across enrolled devices. Open it after enrolling a device."
    },
    {
      id: "school",
      keywords: ["school", "institution", "enterprise", "bulk", "education", "classroom", "district", "institutional"],
      answer:
        "For schools and institutions, use School & Institutional Inquiry on the pricing page (index.html#school) " +
        "or Contact us with inquiry type School / institutional. We offer bulk licensing, term configs, and admin overrides."
    },
    {
      id: "sovereign-vs-sub",
      keywords: ["sovereign gold", "self-host", "self host", "difference", "lifetime", "monthly", "installer bundle"],
      answer:
        "Single Child/Device and Family Haven are monthly subscriptions (period ends last day of calendar month UTC). Sovereign Gold (€49.99/year) " +
        "includes a lifetime licence to run Haven on hardware you own — unlimited devices, total privacy."
    }
  ];

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function wantsHuman(text) {
    var n = normalize(text);
    for (var i = 0; i < HUMAN_INTENT.length; i++) {
      if (n.indexOf(HUMAN_INTENT[i]) !== -1) return true;
    }
    return false;
  }

  function scoreFaq(faq, normalizedPrompt, tokens) {
    var score = 0;
    for (var i = 0; i < faq.keywords.length; i++) {
      var kw = faq.keywords[i];
      if (normalizedPrompt.indexOf(kw) !== -1) score += kw.split(" ").length + 2;
    }
    for (var t = 0; t < tokens.length; t++) {
      if (tokens[t].length < 3) continue;
      for (var j = 0; j < faq.keywords.length; j++) {
        if (faq.keywords[j].indexOf(tokens[t]) !== -1) score += 1;
      }
    }
    return score;
  }

  function matchFaq(prompt) {
    var normalized = normalize(prompt);
    if (!normalized) return null;
    if (wantsHuman(normalized)) return null;

    var tokens = normalized.split(" ");
    var best = null;
    var bestScore = 0;

    for (var i = 0; i < FAQS.length; i++) {
      var s = scoreFaq(FAQS[i], normalized, tokens);
      if (s > bestScore) {
        bestScore = s;
        best = FAQS[i];
      }
    }

    if (best && bestScore >= 2) return best.answer;
    return null;
  }

  function answer(prompt) {
    if (wantsHuman(prompt)) {
      return { ok: false, reply: CONTACT_REDIRECT, source: "human", escalate: true };
    }
    var hit = matchFaq(prompt);
    if (hit) return { ok: true, reply: hit, source: "faq" };
    return { ok: false, reply: CONTACT_REDIRECT, source: "miss", escalate: true };
  }

  global.HavenFAQ = {
    faqs: FAQS,
    match: matchFaq,
    answer: answer,
    wantsHuman: wantsHuman,
    contactRedirect: CONTACT_REDIRECT
  };
})(window);
