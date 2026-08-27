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
 * Haven homepage — live sanctuary activity (#ledger).
 * Polls /api/haven/activity/live (real integrity ledger + anonymized block sync).
 */
(function () {
  "use strict";

  var H = window.Haven;
  var feed = document.getElementById("liveFeed");
  if (!feed || !feed.closest(".sanctuary-demo") || !H || !H.api) return;

  var timeSavedEl = document.getElementById("timeSavedVal");
  var trackersEl = document.getElementById("trackersVal");
  var headerTimeEl = document.getElementById("timeSaved");
  var headerTrackersEl = document.getElementById("trackersNeutralized");
  var heroTimeEl = document.getElementById("heroTimeSaved");
  var heroTrackersEl = document.getElementById("heroTrackers");
  var countEl = document.getElementById("liveCount");
  var toggleBtn = document.getElementById("demoToggle");
  var toggleLabel = document.getElementById("demoToggleLabel");
  var toggleIcon = document.getElementById("demoToggleIcon");
  var liveStatus = document.getElementById("liveStatus");

  var PLAY_ICON = '<path d="M7 5l12 7-12 7z"/>';
  var PAUSE_ICON = '<rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/>';
  var CHECK_SVG = '<path d="m5 13 4 4L19 7"/>';
  var MAX_ITEMS = 10;
  var POLL_MS = (H.cfg && H.cfg.pollMs) || 4000;

  var playing = true;
  var timer = null;
  var visible = true;
  var seen = Object.create(null);
  var seeded = false;

  function esc(s) {
    return H.esc ? H.esc(s) : String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function relTime(iso) {
    if (H.relTime) return H.relTime(iso);
    return iso ? "Just now" : "";
  }

  function tickEl(el, text) {
    if (!el) return;
    el.textContent = text;
    el.classList.remove("tick");
    void el.offsetWidth;
    el.classList.add("tick");
  }

  function renderMetrics(m) {
    if (!m) return;
    var timeStr = String(m.time_saved_sec_today || 0);
    var trackerStr = String(m.trackers_neutralized_today || 0);
    var actionStr = String(m.calm_actions_today || 0);
    if (timeSavedEl) timeSavedEl.textContent = timeStr;
    if (trackersEl) trackersEl.textContent = trackerStr;
    if (countEl) countEl.textContent = actionStr;
    tickEl(headerTimeEl, timeStr);
    tickEl(headerTrackersEl, trackerStr);
    if (heroTimeEl) heroTimeEl.textContent = timeStr + "s";
    if (heroTrackersEl) heroTrackersEl.textContent = trackerStr;
  }

  function feedItem(ev) {
    var el = document.createElement("div");
    el.className = "sanctuary-item entering";
    el.dataset.eventId = ev.id || "";
    el.innerHTML =
      '<div class="sanctuary-item-icon"><svg viewBox="0 0 24 24">' + CHECK_SVG + "</svg></div>" +
      '<div class="sanctuary-item-body">' +
      '  <div class="sanctuary-item-label">' + esc(ev.label) + "</div>" +
      '  <div class="sanctuary-item-detail">' + esc(ev.detail) + "</div>" +
      "</div>" +
      '<span class="sanctuary-item-time">' + esc(relTime(ev.ts)) + "</span>";
    return el;
  }

  function setStatus(text, ok) {
    if (liveStatus) liveStatus.textContent = text;
    var pill = liveStatus ? liveStatus.closest(".pill") : null;
    if (pill) {
      pill.classList.toggle("pill-green", ok !== false);
      pill.classList.toggle("pill-alert", ok === false);
    }
  }

  function offline(msg) {
    setStatus("Offline", false);
    if (!feed.querySelector(".sanctuary-offline")) {
      feed.innerHTML =
        '<div class="sanctuary-offline muted" style="text-align:center;padding:2rem 1rem">' +
        '<p style="font-weight:600;color:var(--ink)">Waiting for live activity…</p>' +
        '<p style="font-size:.86rem;margin-top:.4rem">' + esc(msg || "Check your connection.") + "</p></div>";
    }
  }

  function mergeEvents(events) {
    if (!events || !events.length) return;
    var off = feed.querySelector(".sanctuary-offline");
    if (off) feed.innerHTML = "";

    var fresh = [];
    events.forEach(function (ev) {
      var id = ev.id || (ev.ts + ":" + ev.label);
      if (seen[id]) return;
      seen[id] = true;
      fresh.push(ev);
    });
    if (!fresh.length && seeded) return;

    fresh.sort(function (a, b) {
      return String(a.ts || "").localeCompare(String(b.ts || ""));
    });
    fresh.forEach(function (ev) {
      feed.insertBefore(feedItem(ev), feed.firstChild);
    });
    while (feed.children.length > MAX_ITEMS) feed.removeChild(feed.lastChild);
    seeded = true;
  }

  async function poll() {
    try {
      var data = await H.api.activityLive(MAX_ITEMS);
      if (!data || !data.ok) {
        offline("Activity feed unavailable.");
        return;
      }
      setStatus("Live", true);
      renderMetrics(data.metrics || {});
      if (!(data.events && data.events.length) && !seeded) {
        var total = (data.metrics && data.metrics.chain_entries_total) || 0;
        feed.innerHTML =
          '<div class="sanctuary-offline muted" style="text-align:center;padding:2rem 1rem">' +
          '<p style="font-weight:600;color:var(--ink)">Integrity ledger live</p>' +
          '<p style="font-size:.86rem;margin-top:.4rem">' + esc(String(total)) +
          " proofs notarized — waiting for block sync from active devices.</p></div>";
        seeded = true;
        return;
      }
      mergeEvents(data.events || []);
    } catch (e) {
      offline(e && e.message ? e.message : "");
    }
  }

  function start() {
    playing = true;
    if (!timer) {
      poll();
      timer = setInterval(function () {
        if (playing && visible) poll();
      }, POLL_MS);
    }
    if (toggleIcon) toggleIcon.innerHTML = PAUSE_ICON;
    if (toggleLabel) toggleLabel.textContent = "Pause";
    if (toggleBtn) toggleBtn.setAttribute("aria-pressed", "true");
  }

  function stop() {
    playing = false;
    clearInterval(timer);
    timer = null;
    setStatus("Paused", true);
    if (toggleIcon) toggleIcon.innerHTML = PLAY_ICON;
    if (toggleLabel) toggleLabel.textContent = "Resume";
    if (toggleBtn) toggleBtn.setAttribute("aria-pressed", "false");
  }

  if (toggleBtn) {
    toggleBtn.addEventListener("click", function () {
      playing ? stop() : start();
    });
  }

  document.addEventListener("visibilitychange", function () {
    visible = !document.hidden;
  });

  start();
})();
