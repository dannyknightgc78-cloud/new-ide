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
   Haven — runtime configuration (live, no mock)
   Resolves the base URL of the REAL ABX Witness sidecar that serves
   /api/abx/* and /api/haven/*.

   Resolution order:
     1. ?api=<url> query param (also persisted to localStorage)
     2. localStorage 'haven.apiBase'
     3. localhost dev sidecar when viewing locally
     4. the production tunnel host (ghostgrid.dannygc.cloud)
   ============================================================ */
(function () {
  "use strict";
  // Production: nginx on Vultr fronts 127.0.0.1:8811 at this host for /api/abx/*
  // and (after the go-live runbook) /api/haven/*.
  var PROD = "https://ghostgrid.dannygc.cloud";
  var DEV = "http://127.0.0.1:8870";

  function resolve() {
    var h = (location.hostname || "").toLowerCase();
    if (h === "haven.dannygc.cloud") {
      // Always same-origin — nginx proxies /api/haven/* with trusted local headers.
      // Ignore stale localStorage pointing at ghostgrid (causes dashboard 401).
      try { localStorage.removeItem("haven.apiBase"); } catch (e) { /* ignore */ }
      return location.origin.replace(/\/+$/, "");
    }
    try {
      var q = new URLSearchParams(location.search).get("api");
      if (q) { localStorage.setItem("haven.apiBase", q.replace(/\/+$/, "")); }
      var saved = localStorage.getItem("haven.apiBase");
      if (saved) return saved.replace(/\/+$/, "");
    } catch (e) { /* ignore */ }
    if (location.protocol === "file:" || h === "localhost" || h === "127.0.0.1" || h === "") {
      return DEV;
    }
    return PROD;
  }

  function resolveSiteBase() {
    try {
      if (location.protocol === "file:") return "https://haven.dannygc.cloud";
      var h = (location.hostname || "").toLowerCase();
      if (h) return location.origin.replace(/\/+$/, "");
    } catch (e) { /* ignore */ }
    return "https://haven.dannygc.cloud";
  }

  window.HAVEN_CONFIG = {
    apiBase: resolve(),
    siteBase: resolveSiteBase(),
    prod: PROD,
    dev: DEV,
    // poll cadence (ms) for live feeds
    pollMs: 4000
  };
})();
