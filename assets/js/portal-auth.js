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

/** Haven Customer Portal — shared auth (admin: license + email; user: org slug + email). */
(function (global) {
  "use strict";

  var SESSION_KEY = "haven.org.session";
  var LICENSE_KEY = "haven_license_token";
  var API = "/api/haven/org";
  var gate = global.HavenLicenseGate || null;

  function qs(key) {
    try {
      return new URLSearchParams(global.location.search).get(key) || "";
    } catch (e) {
      return "";
    }
  }

  function getLicenseToken() {
    if (gate && gate.getLicenseToken) return gate.getLicenseToken();
    var fromUrl = qs("license") || qs("license_token") || qs("token");
    if (fromUrl) {
      try { localStorage.setItem(LICENSE_KEY, fromUrl); } catch (e) {}
      return fromUrl;
    }
    try { return localStorage.getItem(LICENSE_KEY) || ""; } catch (e) { return ""; }
  }

  function getSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setSession(data) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  function headers() {
    var sess = getSession();
    var h = { "Content-Type": "application/json" };
    if (sess && sess.session_token) {
      h["X-Haven-Org-Session"] = sess.session_token;
    }
    // Only attach license from the active session — never fall back to localStorage
    // while authenticated (stale ABXLIC1.test etc. caused admin approve failures).
    var lic = (sess && sess.license_token) || "";
    if (!lic && !(sess && sess.session_token)) {
      lic = getLicenseToken();
    }
    if (lic) {
      h["X-Haven-License"] = lic;
    }
    return h;
  }

  function api(path, opts) {
    opts = opts || {};
    return fetch(API + path, {
      method: opts.method || "GET",
      headers: Object.assign(headers(), opts.headers || {}),
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) {
          var err = new Error((j && (j.detail || j.error)) || ("HTTP " + r.status));
          err.code = (j && j.error) || "";
          throw err;
        }
        return j;
      });
    });
  }

  function applySession(res, licenseToken) {
    setSession({
      session_token: res.session_token,
      org: res.org,
      role: res.role,
      email: res.email,
      expires_at: res.expires_at,
      license_token: licenseToken || "",
      license_validated: true,
    });
    return res;
  }

  function validateLicense(token) {
    token = (token || getLicenseToken() || "").trim();
    if (gate && gate.validateLicense) return gate.validateLicense(token);
    if (!token) return Promise.reject(new Error("license_required"));
    return fetch("/api/haven/license/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ token: token, license_token: token }),
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok || !j.ok) throw new Error((j && (j.reason || j.error)) || "invalid_license");
        try { localStorage.setItem(LICENSE_KEY, token); } catch (e) {}
        return j;
      });
    });
  }

  /** Admin Ops sign-in — license token + email. */
  function signIn(email, licenseToken) {
    var lic = (licenseToken || getLicenseToken() || "").trim();
    return validateLicense(lic).then(function () {
      return api("/session", {
        method: "POST",
        body: { license_token: lic, email: email },
      });
    }).then(function (res) {
      return applySession(res, lic);
    });
  }

  /** User portal sign-in — org slug + invited email (no license key). */
  function signInMember(email, orgSlug) {
    var slug = (orgSlug || qs("org") || qs("slug") || "").trim().toLowerCase();
    return api("/session/member", {
      method: "POST",
      body: { email: email, org: slug, slug: slug },
    }).then(function (res) {
      return applySession(res, "");
    });
  }

  function signOut() {
    return api("/session", { method: "DELETE" }).catch(function () {}).finally(clearSession);
  }

  function showAuthGate() {
    var gateEl = document.getElementById("authGate");
    var app = document.getElementById("portalApp");
    if (gateEl) gateEl.classList.remove("hidden");
    if (app) app.classList.add("hidden");
  }

  function hideAuthGate() {
    var gateEl = document.getElementById("authGate");
    var app = document.getElementById("portalApp");
    if (gateEl) gateEl.classList.add("hidden");
    if (app) app.classList.remove("hidden");
  }

  function requireAuth(onReady) {
    showAuthGate();
    ensureValidSession(onReady);
  }

  function ensureValidSession(onReady) {
    var sess = getSession();
    if (!sess || !sess.session_token) {
      showAuthGate();
      return;
    }
    api("/session/me").then(function (res) {
      setSession({
        session_token: res.session_token,
        org: res.org,
        role: res.role,
        email: res.email,
        expires_at: res.expires_at,
        license_token: sess.license_token || "",
        license_validated: true,
      });
      hideAuthGate();
      if (onReady) onReady(getSession());
    }).catch(function () {
      clearSession();
      showAuthGate();
    });
  }

  function bootstrapSessionFromUrl(onReady) {
    var tok = qs("session") || qs("org_session") || "";
    if (!tok) return false;
    setSession({ session_token: tok });
    ensureValidSession(onReady);
    return true;
  }

  function bindAuthForm(opts) {
    opts = opts || {};
    var mode = opts.mode || "admin";
    var onSuccess = opts.onSuccess || opts;
    var form = document.getElementById("authForm");
    var status = document.getElementById("authStatus");
    if (!form) return;

    var licInput = document.getElementById("licenseInput");
    var orgInput = document.getElementById("orgSlugInput");
    var emailInput = document.getElementById("emailInput");

    if (mode === "admin" && licInput && getLicenseToken()) {
      licInput.value = getLicenseToken();
    }
    if (orgInput) {
      var orgFromUrl = qs("org") || qs("slug") || "";
      if (orgFromUrl) orgInput.value = orgFromUrl;
    }
    if (emailInput) {
      var emailFromUrl = qs("email") || "";
      if (emailFromUrl) emailInput.value = emailFromUrl;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = ((emailInput || {}).value || "").trim().toLowerCase();
      if (status) {
        status.className = mode === "user" ? "mh-status" : "portal-status";
        status.textContent = mode === "user" ? "Signing in…" : "Validating license…";
        status.classList.remove("hidden");
      }

      var signInPromise;
      if (mode === "user") {
        var slug = ((orgInput || {}).value || qs("org") || qs("slug") || "").trim().toLowerCase();
        if (!slug) {
          if (status) {
            status.className = "mh-status err";
            status.textContent = "Enter your family Haven name (org slug).";
          }
          return;
        }
        signInPromise = signInMember(email, slug);
      } else {
        var lic = ((licInput || {}).value || getLicenseToken() || "").trim();
        signInPromise = signIn(email, lic);
      }

      signInPromise
        .then(function (res) {
          if (status) {
            status.className = (mode === "user" ? "mh-status" : "portal-status") + " ok";
            status.textContent = "Signed in as " + res.email;
          }
          hideAuthGate();
          if (onSuccess) onSuccess(res);
        })
        .catch(function (err) {
          if (status) {
            status.className = (mode === "user" ? "mh-status" : "portal-status") + " err";
            var msg = err.message || "Sign-in failed";
            if (err.code === "not_a_member") {
              msg = "Ask your parent to set up Haven — they need to invite you in Admin Ops.";
            }
            status.textContent = msg;
          }
        });
    });
  }

  global.HavenPortalAuth = {
    getLicenseToken: getLicenseToken,
    getSession: getSession,
    setSession: setSession,
    clearSession: clearSession,
    validateLicense: validateLicense,
    signIn: signIn,
    signInMember: signInMember,
    signOut: signOut,
    api: api,
    requireAuth: requireAuth,
    ensureValidSession: ensureValidSession,
    bootstrapSessionFromUrl: bootstrapSessionFromUrl,
    bindAuthForm: bindAuthForm,
    headers: headers,
    showAuthGate: showAuthGate,
    hideAuthGate: hideAuthGate,
  };
})(window);
