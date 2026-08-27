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
   Haven — shared client core (LIVE)
   Thin utilities + a fetch layer that talks to the REAL ABX Witness
   sidecar (/api/abx/* and /api/haven/*). No mock data, no client-side
   ledger simulation — every value rendered comes from a live response.
   localStorage is used ONLY as a last-known-state offline cache.
   ============================================================ */
(function (global) {
  "use strict";

  var CFG = global.HAVEN_CONFIG || { apiBase: "http://127.0.0.1:8870", pollMs: 4000 };

  /* ---- API layer ------------------------------------------ */
  function url(path) { return CFG.apiBase.replace(/\/+$/, "") + path; }

  async function getJSON(path, timeoutMs) {
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, timeoutMs || 8000);
    try {
      var r = await fetch(url(path), { signal: ctrl.signal, headers: { "Accept": "application/json" } });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }

  async function postJSON(path, body, timeoutMs) {
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, timeoutMs || 12000);
    try {
      var r = await fetch(url(path), {
        method: "POST", signal: ctrl.signal,
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: body ? JSON.stringify(body) : "{}"
      });
      var data = null;
      try { data = await r.json(); } catch (e) { data = null; }
      return { ok: r.ok, status: r.status, data: data };
    } finally { clearTimeout(t); }
  }

  var api = {
    base: CFG.apiBase,
    health: function () { return getJSON("/api/health"); },
    info: function () { return getJSON("/api/haven/info"); },
    chain: function (limit) { return getJSON("/api/haven/chain?limit=" + (limit || 40)); },
    activityLive: function (limit) { return getJSON("/api/haven/activity/live?limit=" + (limit || 20)); },
    anomalies: function (limit) { return getJSON("/api/haven/anomalies?limit=" + (limit || 20)); },
    state: function () { return getJSON("/api/haven/state"); },
    verify: function () { return getJSON("/api/abx/verify"); },
    stats: function () { return getJSON("/api/abx/stats"); },
    registerDevice: function (d) { return postJSON("/api/haven/device/register", d); },
    command: function (deviceId, command) { return postJSON("/api/haven/command", { device_id: deviceId, command: command }); },
    killswitch: function (deviceId, action) { return postJSON("/api/haven/killswitch", { device_id: deviceId, action: action }); },
    driftTamper: function (field) { return postJSON("/api/haven/system-drift/tamper", { field: field }); },
    driftScan: function () { return postJSON("/api/haven/system-drift/scan"); },
    driftHeal: function () { return postJSON("/api/haven/system-drift/heal"); }
  };

  /* ---- offline last-known cache (NOT a data source) ------- */
  function cacheState(s) { try { localStorage.setItem("haven.lastState", JSON.stringify({ at: Date.now(), s: s })); } catch (e) {} }
  function lastState() {
    try { var v = JSON.parse(localStorage.getItem("haven.lastState")); return v && v.s ? v : null; } catch (e) { return null; }
  }

  /* ---- formatting helpers --------------------------------- */
  function shortHash(h, n) { n = n || 10; if (!h) return "—"; return h.slice(0, n) + "…" + h.slice(-4); }
  function clockTime(iso) {
    try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
    catch (e) { return iso || ""; }
  }
  function relTime(iso) {
    var d = new Date(iso).getTime(); if (isNaN(d)) return "";
    var s = Math.round((Date.now() - d) / 1000);
    if (s < 5) return "just now"; if (s < 60) return s + "s ago";
    var m = Math.round(s / 60); if (m < 60) return m + "m ago";
    var h = Math.round(m / 60); if (h < 24) return h + "h ago";
    return new Date(iso).toLocaleDateString();
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  /* ---- page niceties -------------------------------------- */
  function initReveal() {
    var els = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in global) || !els.length) {
      els.forEach(function (el) { el.classList.add("visible"); }); return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("visible"); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    els.forEach(function (el) { io.observe(el); });
  }
  function setYear() { var y = document.getElementById("year"); if (y) y.textContent = new Date().getFullYear(); }

  document.addEventListener("DOMContentLoaded", function () { initReveal(); setYear(); });

  global.Haven = {
    cfg: CFG, api: api, cacheState: cacheState, lastState: lastState,
    shortHash: shortHash, clockTime: clockTime, relTime: relTime, esc: esc,
    checkSvg: '<svg viewBox="0 0 24 24"><path d="m5 13 4 4L19 7"/></svg>'
  };
})(window);
