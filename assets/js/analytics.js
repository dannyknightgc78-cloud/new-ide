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

/* Haven commercial beacon — page views, clicks, downloads, contact intent (fail silent).
   POSTs to ghostgrid-abx /api/haven/analytics/event */
(function () {
  "use strict";

  var SESSION_KEY = "haven.analytics.session";

  function apiBase() {
    if (window.HAVEN_CONFIG && HAVEN_CONFIG.apiBase) return HAVEN_CONFIG.apiBase.replace(/\/+$/, "");
    if (window.HAVEN_CONFIG && HAVEN_CONFIG.prod) return HAVEN_CONFIG.prod;
    return "https://ghostgrid.dannygc.cloud";
  }

  function sessionId() {
    try {
      var s = localStorage.getItem(SESSION_KEY);
      if (s) return s;
      s =
        (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
        "s-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(SESSION_KEY, s);
      return s;
    } catch (e) {
      return "s-anon-" + Date.now();
    }
  }

  function pagePath() {
    var p = location.pathname || "/";
    var h = location.hash || "";
    if (h && h !== "#") return p + h;
    return p + (location.search || "");
  }

  function send(eventType, subtype, extra) {
    var payload = {
      event_type: eventType,
      subtype: subtype || eventType,
      sessionId: sessionId(),
      path: pagePath(),
    };
    if (extra) {
      for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) payload[k] = extra[k];
    }
    var url = apiBase() + "/api/haven/analytics/event";
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([JSON.stringify(payload)], { type: "application/json" }));
        return;
      }
    } catch (e) {
      /* fall through */
    }
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
      mode: "cors",
    }).catch(function () {});
  }

  function trackPageView() {
    send("page_view", "page_view", { metadata: { url: pagePath() } });
  }

  function assetName(href) {
    var p = (href || "").split("?")[0].split("#")[0];
    return p ? p.split("/").pop() : "";
  }

  function isPaidContext() {
    if (/session_id=/.test(location.search)) return true;
    if (/success\.html/i.test(location.pathname)) return true;
    try {
      return !!localStorage.getItem("haven.lastPlan");
    } catch (e) {
      return false;
    }
  }

  function hookDownloads() {
    document.addEventListener(
      "click",
      function (ev) {
        var el = ev.target;
        while (el && el !== document) {
          if (el.tagName === "A") {
            var href = el.getAttribute("href") || "";
            if (el.hasAttribute("download") || /\.(zip|dmg|apk|mobileconfig)$/i.test(href) || /\/downloads\//i.test(href)) {
              var paid = isPaidContext();
              send("download", "download_" + (assetName(href) || "zip"), {
                asset: href,
                metadata: { asset: href, tier: paid ? "paid" : "free", post_checkout: paid },
              });
            }
            return;
          }
          el = el.parentElement;
        }
      },
      true
    );
  }

  function hookCtas() {
    document.addEventListener(
      "click",
      function (ev) {
        var el = ev.target;
        while (el && el !== document) {
          if (el.matches && el.matches("[data-haven-checkout]")) {
            var plan = (el.getAttribute("data-plan") || "unknown").toLowerCase();
            send("click", "checkout_" + plan, { plan: plan, metadata: { plan: plan, url: pagePath() } });
            return;
          }
          if (el.tagName === "A") {
            var href = el.getAttribute("href") || "";
            if (href.indexOf("#pricing") >= 0) {
              send("click", "cta_pricing", { metadata: { url: href } });
            } else if (/setup\.html/i.test(href)) {
              send("click", "cta_setup", { metadata: { url: href } });
            } else if (/downloads\.html/i.test(href)) {
              send("click", "cta_downloads", { metadata: { url: href } });
            } else if (/ops\.html/i.test(href)) {
              send("click", "cta_ops", { metadata: { url: href } });
            }
            return;
          }
          if (el.classList && (el.classList.contains("btn-primary") || el.classList.contains("btn-ghost"))) {
            send("click", "cta_button", { metadata: { url: pagePath() } });
            return;
          }
          el = el.parentElement;
        }
      },
      true
    );
  }

  function hookHashChanges() {
    window.addEventListener("hashchange", function () {
      trackPageView();
    });
  }

  hookDownloads();
  hookCtas();
  if (!window.HavenSiteAnalytics) {
    trackPageView();
    hookHashChanges();
  }

  function startHeartbeat() {
    setInterval(function () {
      if (document.visibilityState === "visible") send("heartbeat", "heartbeat");
    }, 30000);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") send("heartbeat", "heartbeat");
    });
  }
  startHeartbeat();

  window.HavenAnalytics = {
    track: send,
    trackPageView: trackPageView,
    trackPlatformCta: function (platform, source, action, extra) {
      var meta = { platform: platform, source: source || "downloads", action: action || "tab" };
      if (extra) {
        for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) meta[k] = extra[k];
      }
      send("cta_click", "cta_click", { metadata: meta });
    },
    trackContact: function (subtype) {
      send("contact_inquiry", subtype || "contact_form", { path: pagePath() });
    },
    trackFaqMiss: function () {
      send("faq_miss", "faq_miss", { path: pagePath() });
    },
    trackSpeakToHuman: function () {
      send("speak_to_human", "speak_to_human", { path: pagePath() });
    },
    notifyUnusualQuestion: function (question, opts) {
      opts = opts || {};
      var payload = {
        question: String(question || "").slice(0, 2000),
        session_id: sessionId(),
        path: pagePath(),
        source: opts.source || "miss",
        widget: opts.widget || "site",
      };
      var url = apiBase() + "/api/haven/contact/notify";
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon(url, new Blob([JSON.stringify(payload)], { type: "application/json" }));
          return;
        }
      } catch (e) {
        /* fall through */
      }
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
        mode: "cors",
      }).catch(function () {});
    },
  };
})();
