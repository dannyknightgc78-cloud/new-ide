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
 * Admin API auth: ?token= URL, passcode session, or Bearer from sessionStorage.
 * TEMPORARY: owner passcode gate (15051978) unlocks monitoring without nginx basic auth.
 */
(function () {
  "use strict";

  var KEY = "haven.adminToken";
  var PASSCODE_HDR = "X-Haven-Owner-Passcode";

  function fromQuery() {
    try {
      var p = new URLSearchParams(window.location.search);
      return (p.get("token") || p.get("owner_token") || "").trim();
    } catch (e) {
      return "";
    }
  }

  function persistAndCleanUrl(t) {
    try {
      sessionStorage.setItem(KEY, t);
    } catch (e) {
      /* ignore */
    }
    try {
      if (window.history && window.history.replaceState) {
        var u = new URL(window.location.href);
        if (u.searchParams.has("token") || u.searchParams.has("owner_token")) {
          u.searchParams.delete("token");
          u.searchParams.delete("owner_token");
          window.history.replaceState({}, "", u.pathname + u.search + u.hash);
        }
      }
    } catch (e2) {
      /* ignore */
    }
  }

  function passcodeUnlocked() {
    return window.HavenOwnerPasscodeAuth && HavenOwnerPasscodeAuth.isUnlocked();
  }

  function token() {
    var q = fromQuery();
    if (q) {
      persistAndCleanUrl(q);
      return q;
    }
    try {
      return sessionStorage.getItem(KEY) || "";
    } catch (e) {
      return "";
    }
  }

  function hasAccess() {
    if (passcodeUnlocked()) return true;
    if (token()) return true;
    return false;
  }

  function authHeaders(extra) {
    var h = Object.assign({}, extra || {});
    if (passcodeUnlocked() && window.HavenOwnerPasscodeAuth) {
      var ph = HavenOwnerPasscodeAuth.passcodeHash();
      if (!ph && HavenOwnerPasscodeAuth.EXPECTED_HASH) ph = HavenOwnerPasscodeAuth.EXPECTED_HASH;
      if (ph) {
        h[PASSCODE_HDR] = ph;
        return h;
      }
    }
    var t = token();
    if (t) {
      h["X-Haven-Admin"] = t;
      h["Authorization"] = "Bearer " + t;
    }
    return h;
  }

  var gateDone = false;

  function notifyUnlocked() {
    window.dispatchEvent(new CustomEvent("haven:admin:unlocked"));
  }

  function gate() {
    if (gateDone) return hasAccess();
    if (hasAccess()) {
      gateDone = true;
      notifyUnlocked();
      return true;
    }
    if (document.getElementById("ownerPasscodeOverlay")) return false;
    if (window.HavenOwnerPasscodeAuth) {
      HavenOwnerPasscodeAuth.gate({
        title: "Owner Dashboard",
        lead: "Enter your 8-digit owner passcode. No username or password — temporary mobile gate.",
        contentRoot: document.querySelector(".wrap") || document.body,
        unlockEvent: "haven:admin:unlocked"
      });
    }
    return false;
  }

  function onAdminUnlocked() {
    gateDone = true;
    notifyUnlocked();
  }

  window.addEventListener("haven:owner:unlocked", onAdminUnlocked);
  window.addEventListener("haven:admin:unlocked", function () {
    gateDone = true;
  });

  window.HavenAdminAuth = {
    token: token,
    headers: authHeaders,
    authHeaders: authHeaders,
    gate: gate,
    hasAccess: hasAccess
  };
})();
