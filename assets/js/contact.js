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
   Haven — FAQ chat widget + contact form
   FAQ first; on miss calls POST /api/haven/assist (Trooper LLM).
   ============================================================ */
(function (global) {
  "use strict";

  var CHAT_STORAGE_KEY = "haven.chat.history";
  var institutionalIntentTracked = false;

  function faqEngine() {
    return global.HavenFAQ || null;
  }

  function contactRedirect() {
    var f = faqEngine();
    return (f && f.contactRedirect) || "That's outside our FAQ — please use Contact us and we'll get back to you.";
  }

  function loadChatHistory() {
    try {
      var raw = sessionStorage.getItem(CHAT_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveChatHistory(history) {
    try {
      sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(history));
    } catch (e) {}
  }

  function appendMessage(history, role, text, html) {
    var entry = { role: role, text: text, ts: Date.now(), html: !!html };
    history.push(entry);
    saveChatHistory(history);
    return entry;
  }

  function renderMessage(msg) {
    var isUser = msg.role === "user";
    var bubble = document.createElement("div");
    bubble.className = "chat-msg " + (isUser ? "chat-msg-user" : "chat-msg-assistant");
    var label = document.createElement("div");
    label.className = "chat-msg-label";
    label.textContent = isUser ? "You" : "Haven Assistant";
    var body = document.createElement("div");
    body.className = "chat-msg-body";
    if (msg.html) {
      body.innerHTML = msg.text;
    } else {
      body.textContent = msg.text;
    }
    bubble.appendChild(label);
    bubble.appendChild(body);
    return bubble;
  }

  function scrollMessages() {
    var area = document.getElementById("chatMessages");
    if (area) {
      area.scrollTop = area.scrollHeight;
    }
  }

  function postAssistJSON(path, payload, timeoutMs) {
    var api = global.Haven && global.Haven.api;
    if (api && typeof api.postJSON === "function") {
      return api.postJSON(path, payload, timeoutMs);
    }
    var base = (global.HAVEN_CONFIG && global.HAVEN_CONFIG.apiBase) || "";
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

  function unwrapApiResult(raw) {
    if (!raw || typeof raw !== "object") return raw;
    if (raw.data && typeof raw.data === "object" &&
        ("ok" in raw.data || "reply" in raw.data || "error" in raw.data)) {
      return raw.data;
    }
    if ("reply" in raw || "error" in raw || "message" in raw) return raw;
    return raw;
  }

  function sendChatMessage() {
    var input = document.getElementById("chatInput");
    var history = loadChatHistory();
    var text = (input.value || "").trim();
    if (!text) return;

    appendMessage(history, "user", text);
    input.value = "";
    renderChatMessages(history);
    scrollMessages();

    var engine = faqEngine();
    var result = engine ? engine.answer(text) : { ok: false, reply: contactRedirect(), escalate: true };

    if (result.ok && result.reply) {
      appendMessage(history, "assistant", result.reply);
      renderChatMessages(loadChatHistory());
      scrollMessages();
      return;
    }

    if (!result.ok && !result.escalate) {
      var escHtml = (result.reply || contactRedirect()) +
        ' <a href="#" data-contact-faq data-prefill="' + encodeURIComponent(text) + '">Contact us</a>';
      appendMessage(history, "assistant", escHtml, true);
      renderChatMessages(loadChatHistory());
      scrollMessages();
      return;
    }

    appendMessage(history, "assistant", "Checking…");
    renderChatMessages(loadChatHistory());
    scrollMessages();

    postAssistJSON("/api/haven/assist", { prompt: text.slice(0, 2000) }, 35000).then(function (raw) {
      history = loadChatHistory();
      if (history.length && history[history.length - 1].text === "Checking…") {
        history.pop();
      }
      var data = unwrapApiResult(raw);
      if (data && data.ok && data.reply) {
        appendMessage(history, "assistant", data.reply);
      } else {
        var reply = (data && (data.reply || data.message)) || contactRedirect();
        if (global.HavenAnalytics && global.HavenAnalytics.trackFaqMiss) {
          global.HavenAnalytics.trackFaqMiss();
        }
        if (global.HavenAnalytics && global.HavenAnalytics.notifyUnusualQuestion) {
          global.HavenAnalytics.notifyUnusualQuestion(text, {
            source: (data && data.error) || "miss",
            widget: "chat",
          });
        }
        var esc = reply + ' <a href="#" data-contact-faq data-prefill="' + encodeURIComponent(text) + '">Contact us</a>';
        appendMessage(history, "assistant", esc, true);
      }
      renderChatMessages(loadChatHistory());
      scrollMessages();
    }).catch(function () {
      history = loadChatHistory();
      if (history.length && history[history.length - 1].text === "Checking…") {
        history.pop();
      }
      var esc = contactRedirect() + ' <a href="#" data-contact-faq data-prefill="' + encodeURIComponent(text) + '">Contact us</a>';
      appendMessage(history, "assistant", esc, true);
      renderChatMessages(loadChatHistory());
      scrollMessages();
    });
  }

  function renderChatMessages(history) {
    var area = document.getElementById("chatMessages");
    if (!area) return;
    area.innerHTML = "";
    if (!history.length) {
      var welcome = document.createElement("div");
      welcome.className = "chat-welcome";
      welcome.innerHTML =
        '<div class="chat-welcome-icon"><svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">' +
        '<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z" fill="#1f7a5c"/>' +
        '<path d="m9 12 2 2 4-4" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' +
        '<div><b>Haven Assistant</b><br><span style="color:var(--ink-soft);font-size:.88rem">FAQ first — deeper questions use Trooper AI. Otherwise Contact us.</span></div>';
      area.appendChild(welcome);
    }
    history.forEach(function (m) {
      area.appendChild(renderMessage(m));
    });
  }

  function initChatWidget() {
    var toggle = document.getElementById("chatToggle");
    var panel = document.getElementById("chatPanel");
    var closeBtn = document.getElementById("chatClose");
    var sendBtn = document.getElementById("chatSend");
    var input = document.getElementById("chatInput");

    if (!toggle || !panel) return;

    toggle.addEventListener("click", function () {
      var open = panel.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
      if (open) {
        renderChatMessages(loadChatHistory());
        scrollMessages();
        if (input) input.focus();
      }
    });

    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        panel.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    }

    if (sendBtn) {
      sendBtn.addEventListener("click", sendChatMessage);
    }

    if (input) {
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendChatMessage();
        }
      });
    }
  }

  /* ==========================================================
     CONTACT FORM
     ========================================================== */

  function openContactModal(inquiryType, prefillMessage) {
    var modal = document.getElementById("contactModal");
    if (modal) {
      var typeEl = document.getElementById("contactInquiryType");
      if (typeEl && inquiryType) {
        typeEl.value = inquiryType;
      }
      var msgEl = document.getElementById("contactMessage");
      if (msgEl && prefillMessage) {
        msgEl.value = prefillMessage;
      }
      modal.classList.add("open");
      if (global.HavenAnalytics && global.HavenAnalytics.trackContact) {
        global.HavenAnalytics.trackContact(inquiryType || "faq_escalation");
      }
      var first = modal.querySelector("#contactName, #contactEmail");
      if (first) setTimeout(function () { first.focus(); }, 50);
    }
  }

  function openInstitutionalContact(e) {
    if (e) e.preventDefault();
    institutionalIntentTracked = true;
    if (global.HavenAnalytics && global.HavenAnalytics.trackContact) {
      global.HavenAnalytics.trackContact("school");
    }
    openContactModal("school");
  }

  function closeContactModal() {
    var modal = document.getElementById("contactModal");
    if (modal) modal.classList.remove("open");
  }

  function showToast(kind, text) {
    var existing = document.querySelector(".toast");
    if (existing) existing.remove();
    var toast = document.createElement("div");
    toast.className = "toast toast-" + (kind || "ok");
    toast.textContent = text;
    document.body.appendChild(toast);
    setTimeout(function () {
      toast.classList.add("toast-exit");
      setTimeout(function () { toast.remove(); }, 400);
    }, 4000);
  }

  function validateContactForm() {
    var name = (document.getElementById("contactName").value || "").trim();
    var email = (document.getElementById("contactEmail").value || "").trim();
    var message = (document.getElementById("contactMessage").value || "").trim();
    if (!name) {
      document.getElementById("contactName").focus();
      return "Please enter your name.";
    }
    if (!email || email.indexOf("@") === -1 || email.indexOf(".") === -1) {
      document.getElementById("contactEmail").focus();
      return "Please enter a valid email address.";
    }
    if (!message) {
      document.getElementById("contactMessage").focus();
      return "Please enter a message.";
    }
    return null;
  }

  async function submitContactForm(inquiryType) {
    var err = validateContactForm();
    if (err) {
      showToast("error", err);
      return;
    }

    var btn = document.getElementById("contactSubmitBtn");
    var originalLabel = btn ? btn.textContent : "Send";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Sending…";
    }

    var typeEl = document.getElementById("contactInquiryType");
    var inquiry_type = inquiryType || (typeEl ? typeEl.value : "general");

    var payload = {
      name: (document.getElementById("contactName").value || "").trim(),
      email: (document.getElementById("contactEmail").value || "").trim(),
      phone: (document.getElementById("contactPhone").value || "").trim(),
      address: (document.getElementById("contactAddress").value || "").trim(),
      message: (document.getElementById("contactMessage").value || "").trim(),
      inquiry_type: inquiry_type
    };

    var result;
    try {
      result = await global.Haven.api.postJSON("/api/haven/contact/submit", payload, 15000);
    } catch (e) {
      result = { ok: false, status: 0, data: null };
    }

    if (btn) {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }

    if (result && result.ok) {
      showToast("ok", result.data ? result.data.message : "Message sent.");
      if (global.HavenAnalytics && global.HavenAnalytics.trackContact) {
        if (!(institutionalIntentTracked && inquiry_type === "school")) {
          global.HavenAnalytics.trackContact(inquiry_type);
        }
      }
      institutionalIntentTracked = false;
      var form = document.getElementById("contactForm");
      if (form) form.reset();
      setTimeout(closeContactModal, 1200);
    } else {
      var detail = "";
      if (result && result.data && result.data.error) {
        detail = result.data.error;
      } else if (result && result.status) {
        detail = "HTTP " + result.status;
      } else {
        detail = "Network error — please try again.";
      }
      showToast("error", detail);
    }
  }

  async function submitSchoolForm(e) {
    if (e) e.preventDefault();

    var email = (document.getElementById("schoolEmail").value || "").trim();
    var phone = (document.getElementById("schoolPhone").value || "").trim();
    var message = (document.getElementById("schoolMessage").value || "").trim();

    if (!email || email.indexOf("@") === -1) {
      showToast("error", "Please enter a valid email address.");
      return;
    }
    if (!phone) {
      showToast("error", "Please enter a telephone number.");
      return;
    }
    if (!message) {
      showToast("error", "Please enter a message.");
      return;
    }

    var btn = document.getElementById("schoolSubmitBtn");
    var originalLabel = btn ? btn.textContent : "Submit";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Sending…";
    }

    var payload = {
      name: "School / institutional inquiry",
      email: email,
      phone: phone,
      message: message,
      inquiry_type: "school"
    };

    var result;
    try {
      result = await global.Haven.api.postJSON("/api/haven/contact/submit", payload, 15000);
    } catch (err) {
      result = { ok: false };
    }

    if (btn) {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }

    if (result && result.ok) {
      showToast("ok", "Request sent — we'll be in touch shortly.");
      if (global.HavenAnalytics && global.HavenAnalytics.trackContact) {
        global.HavenAnalytics.trackContact("school");
      }
      var form = document.getElementById("schoolForm");
      if (form) form.reset();
      var modal = document.getElementById("schoolModal");
      if (modal) modal.classList.remove("open");
    } else {
      showToast("error", "Could not send — please try again or email supporthaven@dannygc.cloud.");
    }
  }

  function initContactForm() {
    var openBtns = document.querySelectorAll("[data-contact-open]");
    openBtns.forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        openContactModal("general");
      });
    });

    document.addEventListener("click", function (e) {
      var target = e.target;
      while (target && target !== document) {
        if (target.matches && target.matches("[data-contact-faq]")) {
          e.preventDefault();
          var prefill = "";
          try {
            prefill = decodeURIComponent(target.getAttribute("data-prefill") || "");
          } catch (err) {
            prefill = target.getAttribute("data-prefill") || "";
          }
          if (prefill) prefill = "FAQ question: " + prefill;
          openContactModal("faq_escalation", prefill);
          return;
        }
        target = target.parentElement;
      }
    });

    var schoolBtns = document.querySelectorAll("[data-contact-school]");
    schoolBtns.forEach(function (btn) {
      btn.addEventListener("click", openInstitutionalContact);
    });

    var overlay = document.getElementById("contactModalOverlay");
    if (overlay) {
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) closeContactModal();
      });
    }

    var closeBtn = document.getElementById("contactClose");
    if (closeBtn) {
      closeBtn.addEventListener("click", closeContactModal);
    }

    var form = document.getElementById("contactForm");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        submitContactForm();
      });
    }

    var schoolForm = document.getElementById("schoolForm");
    if (schoolForm) {
      schoolForm.removeAttribute("action");
      schoolForm.removeAttribute("method");
      schoolForm.addEventListener("submit", submitSchoolForm);
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeContactModal();
    });
  }

  global.openSchoolModal = function () {
    var modal = document.getElementById("schoolModal");
    if (modal) modal.classList.add("open");
  };

  global.closeSchoolModal = function () {
    var modal = document.getElementById("schoolModal");
    if (modal) modal.classList.remove("open");
  };

  function applyUrlPrefill() {
    try {
      var q = new URLSearchParams(location.search);
      var prefill = q.get("prefill");
      if (!prefill) return;
      try { prefill = decodeURIComponent(prefill); } catch (e) {}
      var msgEl = document.getElementById("contactMessage");
      if (!msgEl) return;
      if (prefill.indexOf("FAQ question:") !== 0) {
        prefill = "FAQ question: " + prefill;
      }
      msgEl.value = prefill;
      setTimeout(function () {
        try {
          msgEl.focus();
          msgEl.scrollIntoView({ behavior: "smooth", block: "center" });
        } catch (e) {}
      }, 120);
    } catch (e) {}
  }

  document.addEventListener("DOMContentLoaded", function () {
    initChatWidget();
    initContactForm();
    applyUrlPrefill();
  });

})(window);
