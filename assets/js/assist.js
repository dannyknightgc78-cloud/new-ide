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
   Haven — FAQ assistant widget with optional server LLM fallback.

   Answers from static FAQ (faqs.js) first; on miss calls
   POST /api/haven/assist (FAQ + optional Ollama/Qwen). Falls back to Contact.
   ============================================================ */
(function () {
  "use strict";

  var busy = false;
  var SUPPORT_EMAIL = "supporthaven@dannygc.cloud";
  var FALLBACK_LEAD =
    "I don't have that in our FAQ yet";

  function el(tag, attrs, html) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, k)) node.setAttribute(k, attrs[k]);
      }
    }
    if (html != null) node.innerHTML = html;
    return node;
  }

  function faq() {
    return window.HavenFAQ || null;
  }

  function contactRedirect() {
    var f = faq();
    return (f && f.contactRedirect) || "That's outside our FAQ — please use Contact us and we'll get back to you.";
  }

  function hasContactModal() {
    return !!document.getElementById("contactModal");
  }

  function contactHref(prefill, subject) {
    var href = "contact.html";
    var params = [];
    if (subject) params.push("subject=" + encodeURIComponent(subject));
    if (prefill) params.push("prefill=" + encodeURIComponent(prefill));
    if (params.length) href += "?" + params.join("&");
    return href;
  }

  function contactLinkHtml(prefill, subject) {
    subject = subject || "Haven FAQ question";
    if (hasContactModal()) {
      return '<a href="#" data-contact-faq data-prefill="' + encodeURIComponent(prefill || "") + '">Contact us</a>';
    }
    return '<a href="' + contactHref(prefill, subject) + '">Contact us</a>';
  }

  function emailLinkHtml() {
    return '<a href="mailto:' + SUPPORT_EMAIL + '">' + SUPPORT_EMAIL + "</a>";
  }

  function unwrapApiResult(raw) {
    if (!raw || typeof raw !== "object") return raw;
    if (raw.data && typeof raw.data === "object" &&
        ("ok" in raw.data || "reply" in raw.data || "error" in raw.data)) {
      return raw.data;
    }
    if ("reply" in raw || "error" in raw || "message" in raw) return raw;
    return raw;
  }

  function removeThinking(thinking) {
    if (thinking && thinking.parentNode) thinking.parentNode.removeChild(thinking);
  }

  function trackContactFallback(prompt, faqResult, reason) {
    try {
      if (window.HavenAnalytics && window.HavenAnalytics.trackFaqMiss) {
        window.HavenAnalytics.trackFaqMiss();
      }
      if (faqResult && faqResult.source === "human" &&
          window.HavenAnalytics && window.HavenAnalytics.trackSpeakToHuman) {
        window.HavenAnalytics.trackSpeakToHuman();
      }
      if (window.HavenAnalytics && window.HavenAnalytics.notifyUnusualQuestion) {
        window.HavenAnalytics.notifyUnusualQuestion(prompt, {
          source: (faqResult && faqResult.source) || reason || "miss",
          widget: "assist",
        });
      }
    } catch (e) { /* analytics must never block chat replies */ }
  }

  function showContactFallback(refs, prompt, thinking, opts) {
    opts = opts || {};
    removeThinking(thinking);
    trackContactFallback(prompt, opts.faqResult, opts.reason);

    var lead = String(opts.message || FALLBACK_LEAD).trim() || FALLBACK_LEAD;
    var html =
      lead + " — " + contactLinkHtml(prompt, "Haven FAQ question") +
      " or email " + emailLinkHtml();

    addMsg(refs.log, "bot", html, { muted: true, html: true });
    busy = false;
    refs.log.scrollTop = refs.log.scrollHeight;
    try { refs.input.focus(); } catch (e) {}
  }

  function openAssistContact(prefill) {
    prefill = prefill || "";
    var modal = document.getElementById("contactModal");
    if (modal) {
      var typeEl = document.getElementById("contactInquiryType");
      var msgEl = document.getElementById("contactMessage");
      if (typeEl) typeEl.value = "faq_escalation";
      if (msgEl && prefill) msgEl.value = "FAQ question: " + prefill;
      modal.classList.add("open");
      if (window.HavenAnalytics && window.HavenAnalytics.trackContact) {
        window.HavenAnalytics.trackContact("faq_escalation");
      }
      var first = modal.querySelector("#contactName, #contactEmail");
      if (first) setTimeout(function () { first.focus(); }, 50);
      return;
    }
    var inlineMsg = document.getElementById("contactMessage");
    if (inlineMsg && /contact\.html/i.test(location.pathname || "")) {
      if (prefill) inlineMsg.value = "FAQ question: " + prefill;
      inlineMsg.focus();
      try { inlineMsg.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {}
      return;
    }
    location.href = contactHref(prefill, "Haven FAQ question");
  }

  function initContactFallbackHandlers() {
    document.addEventListener("click", function (e) {
      var t = e.target;
      while (t && t !== document) {
        if (t.matches && t.matches("[data-contact-faq]")) {
          e.preventDefault();
          var prefill = "";
          try {
            prefill = decodeURIComponent(t.getAttribute("data-prefill") || "");
          } catch (err) {
            prefill = t.getAttribute("data-prefill") || "";
          }
          openAssistContact(prefill);
          return;
        }
        if (t.matches && t.matches("[data-contact-open]")) {
          e.preventDefault();
          openAssistContact("");
          return;
        }
        t = t.parentElement;
      }
    });
  }

  function postAssistJSON(path, payload, timeoutMs) {
    var api = window.Haven && window.Haven.api;
    if (api && typeof api.postJSON === "function") {
      return api.postJSON(path, payload, timeoutMs);
    }
    var base = (window.HAVEN_CONFIG && window.HAVEN_CONFIG.apiBase) || "";
    var url = base.replace(/\/+$/, "") + path;
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, timeoutMs || 35000);
    return fetch(url, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (data) {
        return { ok: r.ok, status: r.status, data: data };
      });
    }).finally(function () { clearTimeout(t); });
  }

  function build() {
    var launcher = el("button", {
      "type": "button",
      "class": "assist-launcher",
      "id": "assistLauncher",
      "aria-expanded": "false",
      "aria-controls": "assistPanel",
      "aria-label": "Open the Haven FAQ assistant"
    },
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 0 0-9 9c0 1.6.42 3.1 1.16 4.4L3 21l4.7-1.2A9 9 0 1 0 12 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="8.5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="15.5" cy="12" r="1" fill="currentColor"/></svg>' +
      '<span class="assist-launcher-label">Ask Haven</span>'
    );

    var panel = el("section", {
      "class": "assist-panel",
      "id": "assistPanel",
      "role": "dialog",
      "aria-modal": "false",
      "aria-label": "Haven FAQ assistant",
      "hidden": "hidden"
    });

    panel.appendChild(el("header", { "class": "assist-head" },
      '<span class="assist-title">' +
        '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2 4 7v8c0 7 5 12 12 15 7-3 12-8 12-15V7z" fill="#1f7a5c"/><path d="m11 16 3.5 3.5L22 12" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        'Haven Assistant</span>' +
      '<button type="button" class="assist-close" id="assistClose" aria-label="Close the assistant">&times;</button>'
    ));

    var log = el("div", {
      "class": "assist-log",
      "id": "assistLog",
      "role": "log",
      "aria-live": "polite",
      "aria-atomic": "false"
    });
    panel.appendChild(log);

    var form = el("form", { "class": "assist-form", "id": "assistForm" });
    var input = el("input", {
      "type": "text",
      "class": "assist-input",
      "id": "assistInput",
      "name": "prompt",
      "maxlength": "2000",
      "autocomplete": "off",
      "placeholder": "Ask about setup, plans, privacy…",
      "aria-label": "Ask a Haven FAQ question"
    });
    var send = el("button", { "type": "submit", "class": "assist-send", "aria-label": "Send" },
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 20 4l-6 16-3-7z" fill="currentColor"/></svg>');
    form.appendChild(input);
    form.appendChild(send);
    panel.appendChild(form);

    panel.appendChild(el("p", { "class": "assist-foot" },
      "FAQ first — deeper questions use Trooper AI when online. "
      + "Otherwise " + (hasContactModal()
        ? '<a href="#" data-contact-open>Contact us</a>'
        : '<a href="contact.html">Contact us</a>') + "."));

    document.body.appendChild(launcher);
    document.body.appendChild(panel);
    return { launcher: launcher, panel: panel, log: log, form: form, input: input };
  }

  function addMsg(log, who, text, opts) {
    opts = opts || {};
    var row = el("div", { "class": "assist-msg assist-msg-" + who });
    var bubble = el("div", { "class": "assist-bubble" });
    if (opts.html) {
      bubble.innerHTML = text;
    } else {
      bubble.textContent = text;
    }
    if (opts.muted) bubble.className += " assist-bubble-muted";
    row.appendChild(bubble);
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
    return bubble;
  }

  function open(refs) {
    refs.panel.hidden = false;
    refs.launcher.setAttribute("aria-expanded", "true");
    document.body.classList.add("assist-open");
    if (!refs.log.getAttribute("data-greeted")) {
      addMsg(refs.log, "bot",
        "Hi! I can answer common questions about Haven — setup, plans, privacy, and devices. " +
        "For anything else, use Contact us.");
      refs.log.setAttribute("data-greeted", "1");
    }
    setTimeout(function () { try { refs.input.focus(); } catch (e) {} }, 30);
  }

  function close(refs) {
    refs.panel.hidden = true;
    refs.launcher.setAttribute("aria-expanded", "false");
    document.body.classList.remove("assist-open");
    try { refs.launcher.focus(); } catch (e) {}
  }

  function ask(refs, prompt) {
    if (busy) return;
    busy = true;
    addMsg(refs.log, "user", prompt);
    refs.input.value = "";

    try {
      var engine = faq();
      var result = engine ? engine.answer(prompt) : { ok: false, reply: contactRedirect(), escalate: true };

      if (result.ok && result.reply) {
        addMsg(refs.log, "bot", result.reply);
        busy = false;
        refs.log.scrollTop = refs.log.scrollHeight;
        try { refs.input.focus(); } catch (e) {}
        return;
      }

      if (!result.ok && !result.escalate) {
        showContactFallback(refs, prompt, null, {
          message: result.reply || FALLBACK_LEAD,
          faqResult: result,
          reason: result.source || "miss",
        });
        return;
      }

      serverAssist(refs, prompt, result);
    } catch (e) {
      showContactFallback(refs, prompt, null, {
        message: FALLBACK_LEAD,
        faqResult: { source: "client_error" },
        reason: "client_error",
      });
    }
  }

  function serverAssist(refs, prompt, faqResult) {
    var thinking = addMsg(refs.log, "bot", "Checking…", { muted: true });
    var settled = false;

    function finish(reply, opts) {
      if (settled) return;
      settled = true;
      clearTimeout(safetyTimer);
      opts = opts || {};

      if (opts.ok && reply) {
        removeThinking(thinking);
        addMsg(refs.log, "bot", reply);
        busy = false;
        refs.log.scrollTop = refs.log.scrollHeight;
        try { refs.input.focus(); } catch (e) {}
        return;
      }

      showContactFallback(refs, prompt, thinking, {
        message: reply || FALLBACK_LEAD,
        faqResult: faqResult,
        reason: opts.reason || "miss",
      });
    }

    var safetyTimer = setTimeout(function () {
      finish(FALLBACK_LEAD, { ok: false, reason: "llm_timeout" });
    }, 38000);

    var payload = { prompt: prompt.slice(0, 2000) };

    try {
      Promise.resolve(postAssistJSON("/api/haven/assist", payload, 35000)).then(function (raw) {
        var data = unwrapApiResult(raw);
        if (data && data.ok && data.reply) {
          finish(data.reply, { ok: true });
        } else if (data && (data.reply || data.message)) {
          finish(data.reply || data.message, { ok: false, reason: data.error || "faq_miss" });
        } else {
          finish(FALLBACK_LEAD, { ok: false, reason: "empty_response" });
        }
      }).catch(function () {
        finish(
          "Network error — the assistant couldn't reach Haven right now.",
          { ok: false, reason: "network" }
        );
      });
    } catch (e) {
      finish(FALLBACK_LEAD, { ok: false, reason: "client_error" });
    }
  }

  var _refs = null;

  function init() {
    if (document.getElementById("assistLauncher")) return;
    _refs = build();

    _refs.launcher.addEventListener("click", function () {
      if (_refs.panel.hidden) open(_refs); else close(_refs);
    });
    document.getElementById("assistClose").addEventListener("click", function () { close(_refs); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && _refs && !_refs.panel.hidden) close(_refs);
    });
    _refs.form.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = (_refs.input.value || "").trim();
      if (q) ask(_refs, q.slice(0, 2000));
    });

    document.addEventListener("click", function (e) {
      var t = e.target;
      while (t && t !== document) {
        if (t.matches && t.matches("[data-assist-open]")) {
          e.preventDefault();
          openAssist();
          return;
        }
        t = t.parentElement;
      }
    });

    initContactFallbackHandlers();

    if (shouldAutoOpenAssist()) {
      setTimeout(openAssist, 80);
    }
  }

  function shouldAutoOpenAssist() {
    try {
      if (location.hash === "#assist") return true;
      if (/assist\.html$/i.test(location.pathname || "")) return true;
      var q = new URLSearchParams(location.search);
      return q.get("assist") === "1" || q.get("assist") === "open";
    } catch (e) {
      return false;
    }
  }

  function openAssist() {
    if (!_refs) init();
    if (_refs) open(_refs);
  }

  function closeAssist() {
    if (_refs) close(_refs);
  }

  window.HavenAssist = { open: openAssist, close: closeAssist };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* ---- FAQ question submission (routes to contact API) ---- */
  function initFaqForm() {
    var form = document.getElementById("faqForm");
    var submitBtn = document.getElementById("faqSubmitBtn");
    var toast = document.getElementById("faqToast");
    if (!form || !submitBtn) return;

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var question = (document.getElementById("faqQuestion").value || "").trim();
      var email = (document.getElementById("faqEmail").value || "").trim();

      if (!question) {
        showToast(toast, "Please enter a question.", "error");
        return;
      }

      var originalLabel = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = "Submitting…";

      var payload = {
        name: email ? "FAQ visitor" : "FAQ visitor",
        email: email || "faq@haven.local",
        message: "FAQ question: " + question,
        inquiry_type: "faq"
      };

      try {
        var raw = await postAssistJSON("/api/haven/contact/submit", payload, 15000);
        var result = unwrapApiResult(raw);
        if (result && result.ok) {
          showToast(toast, "Question received — we'll get back to you.", "ok");
          if (window.HavenAnalytics && window.HavenAnalytics.trackContact) {
            window.HavenAnalytics.trackContact("faq");
          }
          form.reset();
        } else {
          showToast(toast, "Failed to submit. Please use Contact us instead.", "error");
        }
      } catch (err) {
        showToast(toast, "Network error. Please try Contact us.", "error");
      }

      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    });
  }

  function showToast(toastEl, text, kind) {
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.className = "toast toast-" + (kind || "ok");
    toastEl.style.display = "block";
    setTimeout(function () {
      toastEl.style.display = "none";
    }, 4000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFaqForm);
  } else {
    initFaqForm();
  }
})();
