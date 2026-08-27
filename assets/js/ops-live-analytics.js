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
 * Portal Admin — live site activity panel (polls /api/haven/analytics/live).
 */
(function () {
  "use strict";

  var POLL_MS = 30000;
  var booted = false;
  var pollTimer = null;
  var lastLive = null;
  var authRetryDone = false;
  var unlockPrompted = false;

  function $(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function fmt(n) {
    return n == null ? "—" : Number(n).toLocaleString();
  }

  function apiBase() {
    var host = (location.hostname || "").toLowerCase();
    if (host === "haven.dannygc.cloud") {
      return location.origin.replace(/\/+$/, "");
    }
    if (window.HAVEN_CONFIG && HAVEN_CONFIG.apiBase) return HAVEN_CONFIG.apiBase.replace(/\/+$/, "");
    return location.origin.replace(/\/+$/, "");
  }

  function ownerPasscodeHash() {
    if (!window.HavenOwnerPasscodeAuth) return "";
    var ph = HavenOwnerPasscodeAuth.passcodeHash();
    if (ph) return ph;
    if (HavenOwnerPasscodeAuth.isUnlocked() && HavenOwnerPasscodeAuth.EXPECTED_HASH) {
      return HavenOwnerPasscodeAuth.EXPECTED_HASH;
    }
    return "";
  }

  function hasAuth() {
    if (ownerPasscodeHash()) return true;
    if (window.HavenOpsAuth && HavenOpsAuth.isSessionUnlocked && HavenOpsAuth.isSessionUnlocked()) {
      try {
        if (sessionStorage.getItem("haven.adminToken")) return true;
      } catch (e0) {
        /* ignore */
      }
      if (window.HavenAdminAuth && typeof HavenAdminAuth.token === "function" && HavenAdminAuth.token()) {
        return true;
      }
    }
    return false;
  }

  /** Admin analytics requires Bearer, X-Haven-Admin, or X-Haven-Owner-Passcode (passcode session hash). */
  function authHeaders(extra) {
    var h = Object.assign({ Accept: "application/json" }, extra || {});
    var ph = ownerPasscodeHash();
    if (ph) {
      h["X-Haven-Owner-Passcode"] = ph;
      return h;
    }
    try {
      var tok = sessionStorage.getItem("haven.adminToken") || "";
      if (tok) {
        h.Authorization = "Bearer " + tok;
        h["X-Haven-Admin"] = tok;
        return h;
      }
    } catch (e0) {
      /* ignore */
    }
    if (window.HavenAdminAuth && typeof HavenAdminAuth.token === "function") {
      var adminTok = HavenAdminAuth.token();
      if (adminTok) {
        h.Authorization = "Bearer " + adminTok;
        h["X-Haven-Admin"] = adminTok;
      }
    }
    return h;
  }

  function renderCounts(live) {
    var t = (live && live.totals24h) || {};
    var map = {
      liveHome: t.homepage,
      liveDownloads: t.downloads,
      livePulse: t.pulse,
      liveVideos: t.videos,
      liveContact: t.contact,
      livePricing: t.pricingClicks,
      liveVidSanctuary: t.videoPlaysSanctuary,
      liveVidParable: t.videoPlaysParable,
      liveToday: t.today,
    };
    Object.keys(map).forEach(function (id) {
      var el = $(id);
      if (el) el.textContent = fmt(map[id]);
    });
  }

  function renderSections(sections) {
    var box = $("liveSections");
    if (!box) return;
    if (!sections || !sections.length) {
      box.innerHTML = '<p class="muted pc-hint">No section traffic in the last 24 hours yet.</p>';
      return;
    }
    var max = sections[0].count || 1;
    box.innerHTML = sections
      .map(function (row) {
        var pct = Math.max(4, Math.round((row.count / max) * 100));
        return (
          '<div class="live-sec-row">' +
          '<span class="live-sec-label">' + esc(row.label) + "</span>" +
          '<div class="live-sec-bar" aria-hidden="true"><span style="width:' + pct + '%"></span></div>' +
          '<span class="live-sec-count">' + fmt(row.count) + "</span></div>"
        );
      })
      .join("");
  }

  function renderRecent(recent) {
    var box = $("liveEventFeed");
    if (!box) return;
    if (!recent || !recent.length) {
      box.innerHTML = '<p class="muted pc-hint">Waiting for site events…</p>';
      return;
    }
    box.innerHTML = recent
      .map(function (ev) {
        var ts = String(ev.timestamp || "").slice(11, 19) || "—";
        return (
          '<div class="live-event-row">' +
          '<span class="live-event-ts">' + esc(ts) + "</span>" +
          '<span class="live-event-label">' + esc(ev.label || ev.event_type) + "</span></div>"
        );
      })
      .join("");
  }

  function renderLive(live, statusNote) {
    if (!live) return;
    renderCounts(live);
    renderSections(live.sections);
    renderRecent(live.recent);
    var status = $("liveActivityStatus");
    if (status) {
      var t = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      status.textContent = (statusNote || "Updated ") + t;
      status.className = statusNote ? "pill pill-off" : "pill pill-green";
    }
  }

  function renderOffline(msg, keepData) {
    var status = $("liveActivityStatus");
    if (status) {
      if (keepData && lastLive) {
        status.innerHTML =
          esc(msg || "Feed stale") +
          ' <a href="#" id="liveFeedReunlock" style="color:var(--accent);text-decoration:underline;margin-left:8px;">Re-unlock</a>';
        status.className = "pill pill-off";
        var link = document.getElementById("liveFeedReunlock");
        if (link) {
          link.addEventListener("click", function (e) {
            e.preventDefault();
            unlockPrompted = false;
            authRetryDone = false;
            if (window.HavenOwnerPasscodeAuth) {
              HavenOwnerPasscodeAuth.clearSession();
            }
            window.location.reload();
          });
        }
        return;
      }
      status.textContent = msg || "Offline";
      status.className = "pill pill-off";
    }
  }

  function renderWaiting() {
    var status = $("liveActivityStatus");
    if (status) {
      status.textContent = "Unlock to load live feed";
      status.className = "pill pill-sky";
    }
  }

  function promptUnlockOnce() {
    if (unlockPrompted || !window.HavenOwnerPasscodeAuth) return;
    unlockPrompted = true;
    HavenOwnerPasscodeAuth.gate({
      title: "Session expired",
      lead: "Re-enter your 8-digit owner passcode to restore the live feed.",
      unlockEvent: "haven:owner:unlocked",
    }).then(function (res) {
      if (res && res.unlocked) {
        authRetryDone = false;
        unlockPrompted = false;
        refresh();
      }
    });
  }

  async function fetchLive() {
    return fetch(apiBase() + "/api/haven/analytics/live?hours=24&limit=20", {
      cache: "no-store",
      credentials: "same-origin",
      headers: authHeaders(),
    });
  }

  async function refresh() {
    if (!hasAuth()) {
      if (lastLive) {
        renderLive(lastLive, "Signed out — showing last data · ");
        return;
      }
      renderWaiting();
      return;
    }

    if (window.HavenOwnerPasscodeAuth && typeof HavenOwnerPasscodeAuth.touchSession === "function") {
      HavenOwnerPasscodeAuth.touchSession();
    }

    try {
      var r = await fetchLive();
      if (r.status === 401 && !authRetryDone) {
        authRetryDone = true;
        if (ownerPasscodeHash()) {
          r = await fetchLive();
        }
      }
      if (r.status === 401) {
        if (lastLive) {
          renderLive(lastLive, "Auth expired — cached · ");
          renderOffline("Live feed auth expired", true);
          promptUnlockOnce();
          return;
        }
        renderOffline("Live feed unavailable (401 — re-unlock passcode)", false);
        promptUnlockOnce();
        return;
      }
      if (!r.ok) throw new Error("http " + r.status);
      var data = await r.json();
      if (!data.ok || !data.live) throw new Error("bad payload");
      lastLive = data.live;
      authRetryDone = false;
      renderLive(data.live);
    } catch (e) {
      var detail = e && e.message ? String(e.message) : "error";
      if (lastLive) {
        renderLive(lastLive, "Offline — cached · ");
        renderOffline("Live feed unavailable (" + detail + ")", true);
        return;
      }
      renderOffline("Live feed unavailable (" + detail + ")", false);
    }
  }

  function boot() {
    var panel = $("liveActivityPanel");
    if (!panel) return;
    if (!hasAuth()) {
      if (lastLive) {
        renderLive(lastLive, "Unlock to refresh · ");
      } else {
        renderWaiting();
      }
      return;
    }
    if (!booted) {
      booted = true;
      refresh();
      pollTimer = setInterval(refresh, POLL_MS);
      var btn = $("liveActivityRefresh");
      if (btn) btn.addEventListener("click", refresh);
    } else {
      refresh();
    }
  }

  function onUnlock() {
    authRetryDone = false;
    unlockPrompted = false;
    boot();
  }

  window.HavenOpsLiveAnalytics = { refresh: refresh, boot: boot };

  function shouldBootNow() {
    if (window.HavenOpsAuth && window.HavenOpsAuth.isSessionUnlocked && window.HavenOpsAuth.isSessionUnlocked()) {
      return hasAuth();
    }
    if (window.HavenOwnerPasscodeAuth && HavenOwnerPasscodeAuth.isUnlocked()) {
      return hasAuth();
    }
    if (window.HavenAdminAuth && typeof HavenAdminAuth.hasAccess === "function" && HavenAdminAuth.hasAccess()) {
      return hasAuth();
    }
    return false;
  }

  window.addEventListener("haven:ops:unlocked", onUnlock);
  window.addEventListener("haven:owner:unlocked", onUnlock);
  window.addEventListener("haven:admin:unlocked", onUnlock);
  if (shouldBootNow()) {
    boot();
  } else {
    renderWaiting();
  }
})();
