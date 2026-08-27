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

/**
 * @license
 * Copyright (c) 2026 Haven // Your Sanctuary. All rights reserved.
 *
 * Haven site analytics — section views, pricing clicks, video plays.
 * POSTs to /api/haven/analytics/event (via HavenAnalytics or direct beacon).
 */
(function () {
  "use strict";

  function apiBase() {
    if (window.HAVEN_CONFIG && HAVEN_CONFIG.apiBase) return HAVEN_CONFIG.apiBase.replace(/\/+$/, "");
    if (window.HAVEN_CONFIG && HAVEN_CONFIG.prod) return HAVEN_CONFIG.prod;
    return "https://ghostgrid.dannygc.cloud";
  }

  function sessionId() {
    try {
      var k = "haven.analytics.session";
      var s = localStorage.getItem(k);
      if (s) return s;
      s =
        (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
        "s-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(k, s);
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
    if (window.HavenAnalytics && window.HavenAnalytics.track) {
      window.HavenAnalytics.track(eventType, subtype, extra);
      return;
    }
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

  function sectionForPath(path, hash) {
    var p = String(path || location.pathname || "/").toLowerCase();
    var h = String(hash != null ? hash : location.hash || "").toLowerCase();
    if (p.indexOf("pulse") >= 0) return "pulse";
    if (p.indexOf("downloads") >= 0) return "downloads";
    if (p.indexOf("videos") >= 0) return "videos";
    if (p.indexOf("contact") >= 0) return "contact";
    if (p.indexOf("ops") >= 0) return "ops";
    if (p.indexOf("setup") >= 0) return "setup";
    if (p.indexOf("faq") >= 0) return "faq";
    if (h.indexOf("pricing") >= 0 || p.indexOf("pricing") >= 0) return "pricing";
    if (p === "/" || p.indexOf("index") >= 0) return "homepage";
    return "other";
  }

  function trackSectionView() {
    var path = pagePath();
    var section = sectionForPath(location.pathname, location.hash);
    send("page_view", "page_view_" + section, {
      metadata: { section: section, url: path },
    });
  }

  function trackVideoPlay(videoId, source) {
    send("video_play", "video_play_" + videoId, {
      metadata: { video_id: videoId, source: source || "unknown", url: pagePath() },
    });
  }

  function hookPricingClicks() {
    document.addEventListener(
      "click",
      function (ev) {
        var el = ev.target;
        while (el && el !== document) {
          if (el.tagName === "A") {
            var href = el.getAttribute("href") || "";
            if (href.indexOf("#pricing") >= 0 || /pricing/i.test(href)) {
              send("click", "cta_pricing", { metadata: { url: href, section: "pricing" } });
            }
            return;
          }
          if (el.matches && el.matches("[data-haven-checkout]")) {
            var plan = (el.getAttribute("data-plan") || "unknown").toLowerCase();
            send("click", "checkout_" + plan, { plan: plan, metadata: { plan: plan, section: "pricing", url: pagePath() } });
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
      if (location.hash && location.hash.indexOf("pricing") >= 0) {
        send("click", "cta_pricing", { metadata: { url: pagePath(), section: "pricing" } });
      }
      trackSectionView();
    });
  }

  function hookVideoCards() {
    document.querySelectorAll("[data-video-card]").forEach(function (card, idx) {
      var playBtn = card.querySelector("[data-video-play]");
      var video = card.querySelector("video");
      if (!playBtn || !video) return;
      var videoId =
        card.getAttribute("data-video-id") ||
        (idx === 0 ? "sanctuary" : idx === 1 ? "parable" : "video-" + idx);
      playBtn.addEventListener("click", function () {
        trackVideoPlay(videoId, "videos_page");
      });
    });

    var hero = document.getElementById("heroVideo");
    if (hero) {
      var heroStarted = false;
      hero.addEventListener("play", function () {
        if (heroStarted) return;
        heroStarted = true;
        trackVideoPlay("sanctuary", "hero");
      });
    }

    var parableBtn = document.getElementById("parablePlay");
    var parable = document.getElementById("parableVideo");
    if (parableBtn && parable) {
      parableBtn.addEventListener("click", function () {
        trackVideoPlay("parable", "homepage");
      });
    }
  }

  function init() {
    trackSectionView();
    hookHashChanges();
    hookPricingClicks();
    hookVideoCards();
  }

  window.HavenSiteAnalytics = {
    sectionForPath: sectionForPath,
    trackSectionView: trackSectionView,
    trackVideoPlay: trackVideoPlay,
    init: init,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
