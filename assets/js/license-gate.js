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
 * Haven license gate — validate ABXLIC1 via /api/haven/license/validate.
 */
(function (global) {
  "use strict";

  var LICENSE_KEY = "haven_license_token";
  var SETUP_PAGE = "setup.html";

  function qs(key) {
    try {
      return new URLSearchParams(global.location.search).get(key) || "";
    } catch (e) {
      return "";
    }
  }

  function getLicenseToken() {
    var fromUrl = qs("license") || qs("license_token") || qs("token");
    if (fromUrl) {
      try { localStorage.setItem(LICENSE_KEY, fromUrl); } catch (e) {}
      return fromUrl;
    }
    try { return localStorage.getItem(LICENSE_KEY) || sessionStorage.getItem(LICENSE_KEY) || ""; } catch (e) { return ""; }
  }

  function persistLicense(token) {
    if (!token) return;
    try {
      localStorage.setItem(LICENSE_KEY, token);
      sessionStorage.setItem(LICENSE_KEY, token);
    } catch (e) {}
  }

  function validateLicense(token) {
    token = (token || getLicenseToken() || "").trim();
    if (!token) return Promise.reject(new Error("license_required"));
    return fetch("/api/haven/license/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ token: token, license_token: token }),
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok || !j.ok) {
          throw new Error((j && (j.reason || j.error)) || "invalid_license");
        }
        persistLicense(token);
        return j;
      });
    });
  }

  function redirectToSetup(reason) {
    var dest = SETUP_PAGE + "?need=license";
    if (reason) dest += "&reason=" + encodeURIComponent(reason);
    var lic = getLicenseToken();
    if (lic) dest += "&license=" + encodeURIComponent(lic);
    global.location.replace(dest);
  }

  function isInstallFlow() {
    try {
      var q = new URLSearchParams(global.location.search || "");
      if (q.get("install") === "1" || q.get("platform") === "ios" || q.get("source") === "ios-profile") return true;
    } catch (e) {}
    if (global.navigator && global.navigator.standalone === true) return false;
    try {
      return global.matchMedia("(display-mode: standalone)").matches && !getLicenseToken();
    } catch (e2) {
      return false;
    }
  }

  function isChildDeviceFlow() {
    try {
      var q = new URLSearchParams(global.location.search || "");
      if (q.get("device") || q.get("role") === "child") return true;
      if (localStorage.getItem("haven_app_role") === "child") return true;
    } catch (e) {}
    return false;
  }

  function requireValidLicense(opts) {
    opts = opts || {};
    if (opts.allowInstall !== false && isInstallFlow()) {
      return Promise.resolve({ ok: true, skipped: "install_flow" });
    }
    var token = getLicenseToken();
    if (!token) {
      if (opts.allowInstall !== false && isChildDeviceFlow()) {
        return Promise.resolve({ ok: true, skipped: "child_device_no_license" });
      }
      if (opts.redirect !== false) redirectToSetup("missing");
      return Promise.reject(new Error("license_required"));
    }
    return validateLicense(token).catch(function (err) {
      try { localStorage.removeItem(LICENSE_KEY); } catch (e) {}
      if (opts.allowInstall !== false && isChildDeviceFlow()) {
        return Promise.resolve({ ok: false, skipped: "child_device_invalid_license" });
      }
      if (opts.redirect !== false) redirectToSetup(err.message || "invalid_license");
      throw err;
    });
  }

  global.HavenLicenseGate = {
    getLicenseToken: getLicenseToken,
    persistLicense: persistLicense,
    validateLicense: validateLicense,
    requireValidLicense: requireValidLicense,
    redirectToSetup: redirectToSetup,
  };
})(window);
