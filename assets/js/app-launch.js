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
 * Haven — installed app entry (PWA / iOS Home Screen / profile web clip).
 * Routes admins with a license to Portal Admin; My Portal devices stay on child.html.
 */
(function () {
  "use strict";

  var ROLE_KEY = "haven_app_role";
  var LICENSE_KEY = "haven_license_token";
  var CHILD_HOME = "child.html";
  var PARENT_HOME = "ops.html";
  var OWNER_HOME = "admin.html";
  var SETUP_KEY = "haven_pwa_setup_v1";

  var MARKETING = {
    "": true,
    "index.html": true,
    "ios-install.html": true,
    "downloads.html": true,
    "success.html": true,
    "setup.html": true,
    "pricing.html": true,
    "install-guide.html": true
  };

  function params() {
    try { return new URLSearchParams(window.location.search || ""); } catch (_e) { return new URLSearchParams(); }
  }

  function currentPage() {
    var path = (window.location.pathname || "").split("/").pop() || "";
    return path || "index.html";
  }

  function isStandalone() {
    if (window.navigator.standalone === true) return true;
    try { return window.matchMedia("(display-mode: standalone)").matches; } catch (_e) { return false; }
  }

  function isIosProfileLaunch() {
    try { return params().get("source") === "ios-profile"; } catch (_e) { return false; }
  }

  function persistLicense(q, opts) {
    opts = opts || {};
    var lic = q.get("license") || q.get("license_token") || "";
    if (!lic) return false;
    try {
      localStorage.setItem(LICENSE_KEY, lic);
      sessionStorage.setItem(LICENSE_KEY, lic);
      if (!opts.childInstall) {
        localStorage.setItem(ROLE_KEY, "parent");
      }
    } catch (_e) { /* ignore */ }
    return true;
  }

  function isChildInstallFlow(q) {
    if (q.get("role") === "parent" || q.get("parent") === "1" || q.get("view") === "ops") return false;
    if (q.get("role") === "child" || q.get("device")) return true;
    /* URL install signals win over stale localStorage parent role (checkout / ops visits). */
    if (q.get("install") === "1" || q.get("platform") === "ios" || q.get("source") === "ios-profile") return true;
    /* PWA Home Screen icon always opens the child sanctuary shell — not Portal Admin. */
    if (isStandalone() && currentPage() === CHILD_HOME) return true;
    if (q.get("license") || q.get("license_token")) return false;
    try {
      if (localStorage.getItem(ROLE_KEY) === "parent") return false;
      if (localStorage.getItem(LICENSE_KEY)) return false;
    } catch (_e) { /* ignore */ }
    return false;
  }

  function resolveRole(q) {
    var role = q.get("role");
    if (role === "parent" || role === "child") {
      try { localStorage.setItem(ROLE_KEY, role); } catch (_e) { /* ignore */ }
      return role;
    }
    if (q.get("view") === "ops" || q.get("parent") === "1") {
      try { localStorage.setItem(ROLE_KEY, "parent"); } catch (_e) { /* ignore */ }
      return "parent";
    }
    persistLicense(q);
    try {
      var stored = localStorage.getItem(ROLE_KEY);
      if (stored === "parent" || stored === "child") return stored;
      if (localStorage.getItem(LICENSE_KEY)) return "parent";
    } catch (_e) { /* ignore */ }
    return "child";
  }

  function resolveHome(role, q) {
    if (q.get("token")) return OWNER_HOME;
    try {
      if (localStorage.getItem("haven.owner.passcodeOk") === "1") return OWNER_HOME;
      try {
        if (global.HavenOwnerPasscodeAuth && global.HavenOwnerPasscodeAuth.isUnlocked()) return OWNER_HOME;
        if (localStorage.getItem("haven.owner.passcodeOk") === "1") return OWNER_HOME;
        if (sessionStorage.getItem("haven.owner.passcodeOk") === "1") return OWNER_HOME;
      } catch (_e) { /* ignore */ }
    } catch (_e) { /* ignore */ }
    return role === "parent" ? PARENT_HOME : CHILD_HOME;
  }

  function buildUrl(page, q) {
    var p = new URLSearchParams(q.toString());
    if (page !== CHILD_HOME) p.delete("install");
    var qs = p.toString();
    return page + (qs ? ("?" + qs) : "");
  }

  function redirectIfWrongShell() {
    var page = currentPage();
    if (page === "ops.html" || page === "admin.html") return;

    var q = params();
    var childInstall = isChildInstallFlow(q);
    persistLicense(q, { childInstall: childInstall });

    if (page === "child.html" && childInstall) return;

    var role = resolveRole(q);
    var home = resolveHome(role, q);

    if (page === "child.html" && role === "parent" && !childInstall) {
      window.location.replace(buildUrl(home, q));
      return;
    }

    if (MARKETING[page] && (isStandalone() || isIosProfileLaunch())) {
      window.location.replace(buildUrl(home, q));
    }
  }

  window.HavenAppLaunch = {
    ROLE_KEY: ROLE_KEY,
    LICENSE_KEY: LICENSE_KEY,
    CHILD_HOME: CHILD_HOME,
    PARENT_HOME: PARENT_HOME,
    OWNER_HOME: OWNER_HOME,
    SETUP_KEY: SETUP_KEY,
    APP_HOME: CHILD_HOME,
    isStandalone: isStandalone,
    isChildInstallFlow: isChildInstallFlow,
    resolveRole: resolveRole,
    resolveHome: resolveHome,
    isInstallMode: function () {
      var q = params();
      if (q.get("install") === "1" || q.get("platform") === "ios") return true;
      return currentPage() === "ios-install.html";
    },
    needsSetup: function () {
      try { return !localStorage.getItem(SETUP_KEY); } catch (_e) { return true; }
    },
    markSetupComplete: function () {
      try { localStorage.setItem(SETUP_KEY, new Date().toISOString()); } catch (_e) { /* ignore */ }
    }
  };

  redirectIfWrongShell();
})();
