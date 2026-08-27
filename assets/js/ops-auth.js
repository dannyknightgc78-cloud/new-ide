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

/* Haven Portal Admin — dual auth gate (master password + optional WebAuthn passkey). */
(function (global) {
  "use strict";

  if (typeof global.HavenWatermark === "function") global.HavenWatermark();

  var STORAGE_PARENT_HASH = "masterPasswordHash";
  var STORAGE_WEB_HASH = "haven.ops.masterPasswordHash";
  var STORAGE_PASSKEY = "haven.ops.passkeyCredentialId";
  var SESSION_UNLOCK = "haven.ops.unlocked";
  var SESSION_HASH = "haven.ops.hashSync";
  var MIN_PASSWORD_LEN = 8;
  var RP_NAME = "Haven Portal Admin";

  function sha256Hex(text) {
    return crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(text))
      .then(function (buf) {
        return Array.from(new Uint8Array(buf))
          .map(function (b) {
            return b.toString(16).padStart(2, "0");
          })
          .join("");
      });
  }

  function extensionOrigin() {
    try {
      return /^chrome-extension:/.test(global.location && global.location.protocol);
    } catch (e) {
      return false;
    }
  }

  function webAuthnSupported() {
    return (
      typeof global.PublicKeyCredential !== "undefined" &&
      typeof navigator.credentials !== "undefined" &&
      typeof navigator.credentials.create === "function"
    );
  }

  function rpId() {
    if (extensionOrigin() && typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id) {
      return chrome.runtime.id;
    }
    var h = (global.location && global.location.hostname) || "localhost";
    if (h === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(h)) return "localhost";
    if (h.endsWith(".dannygc.cloud")) return "dannygc.cloud";
    return h;
  }

  function b64UrlToBuf(s) {
    var pad = "=".repeat((4 - (s.length % 4)) % 4);
    var b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
    var raw = atob(b64);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out.buffer;
  }

  function bufToB64Url(buf) {
    var bytes = new Uint8Array(buf);
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function getStoredPasskeyId() {
    try {
      return localStorage.getItem(STORAGE_PASSKEY) || "";
    } catch (e) {
      return "";
    }
  }

  function setStoredPasskeyId(id) {
    try {
      if (id) localStorage.setItem(STORAGE_PASSKEY, id);
      else localStorage.removeItem(STORAGE_PASSKEY);
    } catch (e) {
      /* ignore */
    }
  }

  function markSessionUnlocked() {
    try {
      sessionStorage.setItem(SESSION_UNLOCK, String(Date.now()));
    } catch (e) {
      /* ignore */
    }
  }

  function isSessionUnlocked() {
    try {
      return Boolean(sessionStorage.getItem(SESSION_UNLOCK));
    } catch (e) {
      return false;
    }
  }

  function syncHashToSession(hash) {
    try {
      if (hash) sessionStorage.setItem(SESSION_HASH, hash);
    } catch (e) {
      /* ignore */
    }
  }

  function getWebStoredHash() {
    try {
      return (
        sessionStorage.getItem(SESSION_HASH) ||
        localStorage.getItem(STORAGE_WEB_HASH) ||
        localStorage.getItem(STORAGE_PARENT_HASH) ||
        ""
      );
    } catch (e) {
      return "";
    }
  }

  function setWebStoredHash(hash) {
    try {
      localStorage.setItem(STORAGE_WEB_HASH, hash);
      syncHashToSession(hash);
    } catch (e) {
      /* ignore */
    }
  }

  function getExtensionHash() {
    return new Promise(function (resolve) {
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
        resolve("");
        return;
      }
      chrome.storage.local.get(STORAGE_PARENT_HASH, function (row) {
        resolve((row && row[STORAGE_PARENT_HASH]) || "");
      });
    });
  }

  function setExtensionHash(hash) {
    return new Promise(function (resolve) {
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
        resolve(false);
        return;
      }
      var patch = {};
      patch[STORAGE_PARENT_HASH] = hash;
      chrome.storage.local.set(patch, function () {
        resolve(true);
      });
    });
  }

  function checkPremiumWeb() {
    var token = "";
    try {
      token = localStorage.getItem("haven.licenseToken") || "";
    } catch (e) {
      /* ignore */
    }
    if (token && token.indexOf("ABXLIC1") === 0) return Promise.resolve(true);
    return fetch((global.HAVEN_CONFIG && global.HAVEN_CONFIG.apiBase) || "https://ghostgrid.dannygc.cloud")
      .then(function () {
        return false;
      })
      .catch(function () {
        return false;
      });
  }

  function checkPremiumExtension() {
    return new Promise(function (resolve) {
      if (typeof isPremium === "function" && typeof chrome !== "undefined") {
        isPremium(chrome, "family").then(resolve);
        return;
      }
      if (typeof chrome === "undefined" || !chrome.runtime) {
        resolve(false);
        return;
      }
      chrome.runtime.sendMessage({ type: "haven-is-premium", product: "family" }, function (res) {
        resolve(Boolean(res && res.premium));
      });
    });
  }

  function buildOverlay() {
    var overlay = document.createElement("div");
    overlay.id = "opsAuthOverlay";
    overlay.className = "ops-auth-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "opsAuthTitle");
    overlay.innerHTML =
      '<div class="ops-auth-card">' +
      '<div class="ops-auth-shield" aria-hidden="true">' +
      '<svg viewBox="0 0 32 32"><path d="M16 2 4 7v8c0 7 5 12 12 15 7-3 12-8 12-15V7z" fill="#00ffcc"/><path d="m11 16 3.5 3.5L22 12" stroke="#0a0f1a" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      "</div>" +
      '<h2 id="opsAuthTitle">Sanctuary Authentication</h2>' +
      '<p class="ops-auth-lead" id="opsAuthLead">Enter your master password to unlock the Portal Admin. My Portal users cannot access this dashboard.</p>' +
      '<div class="ops-auth-paywall hidden" id="opsAuthPaywall">' +
      '<p>Premium <code>ABXLIC1</code> license required for the Portal Admin.</p>' +
      '<a class="ops-auth-upgrade" href="https://haven.dannygc.cloud/#pricing" target="_blank" rel="noopener">View Premium Plans</a>' +
      "</div>" +
      '<label class="ops-auth-label" for="opsAuthPassword">Master password</label>' +
      '<div class="ops-auth-row">' +
      '<input type="password" id="opsAuthPassword" class="ops-auth-input" autocomplete="current-password" placeholder="Master password" />' +
      '<button type="button" id="opsAuthSubmit" class="ops-auth-btn">Unlock</button>' +
      "</div>" +
      '<button type="button" id="opsAuthPasskey" class="ops-auth-passkey hidden">Unlock with Passkey</button>' +
      '<button type="button" id="opsAuthRegisterPasskey" class="ops-auth-passkey-secondary hidden">Register Touch ID / Face ID</button>' +
      '<p class="ops-auth-msg" id="opsAuthMsg" aria-live="polite"></p>' +
      "</div>";
    return overlay;
  }

  function setMsg(el, text, ok) {
    if (!el) return;
    el.textContent = text || "";
    el.className = "ops-auth-msg" + (text ? (ok ? " ok" : " err") : "");
  }

  async function registerPasskey(userId) {
    var challenge = crypto.getRandomValues(new Uint8Array(32));
    var userBuf = new TextEncoder().encode(userId || "haven-parent");
    var cred = await navigator.credentials.create({
      publicKey: {
        challenge: challenge,
        rp: { name: RP_NAME, id: rpId() },
        user: { id: userBuf, name: "guardian@haven.local", displayName: "Haven Guardian" },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred"
        },
        timeout: 60000,
        attestation: "none"
      }
    });
    if (!cred || !cred.rawId) throw new Error("passkey_create_failed");
    setStoredPasskeyId(bufToB64Url(cred.rawId));
    return cred;
  }

  async function unlockWithPasskey() {
    var credId = getStoredPasskeyId();
    if (!credId) throw new Error("no_passkey");
    var challenge = crypto.getRandomValues(new Uint8Array(32));
    var assertion = await navigator.credentials.get({
      publicKey: {
        challenge: challenge,
        rpId: rpId(),
        allowCredentials: [{ type: "public-key", id: b64UrlToBuf(credId) }],
        userVerification: "required",
        timeout: 60000
      }
    });
    if (!assertion) throw new Error("passkey_denied");
    return true;
  }

  function blurContent(root, on) {
    if (!root) return;
    root.classList.toggle("ops-auth-blurred", on);
    root.setAttribute("aria-hidden", on ? "true" : "false");
  }

  function revealContent(overlay, root) {
    overlay.classList.add("ops-auth-exiting");
    blurContent(root, false);
    setTimeout(function () {
      overlay.remove();
      document.body.classList.remove("ops-auth-locked");
      global.dispatchEvent(new CustomEvent("haven:ops:unlocked"));
    }, 420);
  }

  function ownerBypassHash(hash) {
    return hash === "haven_owner_bypass_vault";
  }

  var ADMIN_TOKEN_KEY = "haven.adminToken";
  var EXT_ID = "eikiogjbemlemhopfecgcpgfndbhpdkj";

  function adminTokenFromQuery() {
    try {
      var p = new URLSearchParams(global.location.search);
      return (p.get("token") || p.get("owner_token") || "").trim();
    } catch (e) {
      return "";
    }
  }

  function adminTokenFromSession() {
    try {
      return sessionStorage.getItem(ADMIN_TOKEN_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  function persistAdminToken(t) {
    try {
      sessionStorage.setItem(ADMIN_TOKEN_KEY, t);
    } catch (e) {
      /* ignore */
    }
    try {
      if (global.history && global.history.replaceState) {
        var u = new URL(global.location.href);
        if (u.searchParams.has("token") || u.searchParams.has("owner_token")) {
          u.searchParams.delete("token");
          u.searchParams.delete("owner_token");
          global.history.replaceState({}, "", u.pathname + u.search + u.hash);
        }
      }
    } catch (e2) {
      /* ignore */
    }
  }

  function isOwnerLicenseToken() {
    try {
      var tok = localStorage.getItem("haven.licenseToken") || "";
      if (!tok || tok.indexOf("ABXLIC1") !== 0) return false;
      var bodyB64 = tok.split(".", 3)[1];
      if (!bodyB64) return false;
      var pad = "=".repeat((4 - (bodyB64.length % 4)) % 4);
      var json = atob(bodyB64.replace(/-/g, "+").replace(/_/g, "/") + pad);
      var p = JSON.parse(json);
      if (!p) return false;
      if (p.display_code === "HVN-ADMIN-FAMILY") return true;
      if (p.lic_id === "lic-admin_comp_f") return true;
      if (p.comp_reason === "owner_lifetime") return true;
      if (String(p.customer || "").toLowerCase() === "dannyknightgc78@gmail.com") return true;
      return Boolean(p.admin_comp);
    } catch (e) {
      return false;
    }
  }

  function getOwnerBypassFlag() {
    return new Promise(function (resolve) {
      try {
        if (localStorage.getItem("haven.owner.bypassVault") === "true") {
          resolve(true);
          return;
        }
      } catch (e) {
        /* ignore */
      }
      if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) {
        resolve(false);
        return;
      }
      try {
        chrome.runtime.sendMessage(EXT_ID, { type: "haven-ops-get-bypass" }, function (res) {
          if (chrome.runtime.lastError) resolve(false);
          else resolve(Boolean(res && res.ownerBypass));
        });
      } catch (e) {
        resolve(false);
      }
    });
  }

  function validateAdminToken(tok) {
    if (!tok) return Promise.resolve(false);
    var base =
      (global.HAVEN_CONFIG && global.HAVEN_CONFIG.apiBase) ||
      (global.location && global.location.origin) ||
      "";
    return fetch(String(base).replace(/\/+$/, "") + "/api/haven/analytics/summary", {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json", Authorization: "Bearer " + tok }
    })
      .then(function (r) {
        return r.ok;
      })
      .catch(function () {
        return false;
      });
  }

  async function ownerBypassReady(options, storedHashEarly) {
    if (ownerBypassHash(storedHashEarly)) return true;
    if (await getOwnerBypassFlag()) return true;
    if (isOwnerLicenseToken()) return true;
    var qTok = adminTokenFromQuery();
    if (qTok && (await validateAdminToken(qTok))) {
      persistAdminToken(qTok);
      return true;
    }
    var sTok = adminTokenFromSession();
    if (sTok && (await validateAdminToken(sTok))) return true;
    return false;
  }

  function finishOwnerBypass(root) {
    markSessionUnlocked();
    blurContent(root, false);
    document.body.classList.remove("ops-auth-locked");
    global.dispatchEvent(new CustomEvent("haven:ops:unlocked"));
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({ type: "haven-ops-session", unlocked: true }, function () {});
    }
  }

  async function init(options) {
    options = options || {};
    var mode = options.mode === "extension" ? "extension" : "web";
    var root = options.contentRoot || document.querySelector(".ops-shell") || document.body;
    var skipIfUnlocked = options.skipIfUnlocked !== false;

    if (skipIfUnlocked && isSessionUnlocked()) {
      blurContent(root, false);
      global.dispatchEvent(new CustomEvent("haven:ops:unlocked"));
      return { unlocked: true, skipped: true };
    }

    /* Web owner monitoring: passcode-only gate (no master password / passkey on iPhone Safari). */
    if (mode === "web" && global.HavenOwnerPasscodeAuth) {
      if (global.HavenOwnerPasscodeAuth.isUnlocked()) {
        markSessionUnlocked();
        blurContent(root, false);
        global.dispatchEvent(new CustomEvent("haven:ops:unlocked"));
        return { unlocked: true, skipped: true, passcode: true };
      }
      var qTok = adminTokenFromQuery();
      if (qTok && (await validateAdminToken(qTok))) {
        persistAdminToken(qTok);
        finishOwnerBypass(root);
        return { unlocked: true, ownerBypass: true };
      }
      var sTok = adminTokenFromSession();
      if (sTok && (await validateAdminToken(sTok))) {
        finishOwnerBypass(root);
        return { unlocked: true, ownerBypass: true };
      }
      await global.HavenOwnerPasscodeAuth.gate({
        title: "Portal Admin",
        lead: "Enter your 8-digit owner passcode to unlock the household console. No username or master password.",
        contentRoot: root,
        unlockEvent: "haven:ops:unlocked"
      });
      markSessionUnlocked();
      return { unlocked: true, passcode: true };
    }

    var storedHashEarly =
      mode === "extension"
        ? await getExtensionHash()
        : typeof options.getHash === "function"
          ? await options.getHash()
          : getWebStoredHash();
    if (await ownerBypassReady(options, storedHashEarly)) {
      finishOwnerBypass(root);
      return { unlocked: true, ownerBypass: true };
    }

    document.body.classList.add("ops-auth-locked", "ops-dark");
    blurContent(root, true);

    var overlay = buildOverlay();
    document.body.appendChild(overlay);

    var titleEl = document.getElementById("opsAuthTitle");
    var leadEl = document.getElementById("opsAuthLead");
    var paywallEl = document.getElementById("opsAuthPaywall");
    var passInput = document.getElementById("opsAuthPassword");
    var submitBtn = document.getElementById("opsAuthSubmit");
    var passkeyBtn = document.getElementById("opsAuthPasskey");
    var registerBtn = document.getElementById("opsAuthRegisterPasskey");
    var msgEl = document.getElementById("opsAuthMsg");

    var premium =
      mode === "extension"
        ? await checkPremiumExtension()
        : typeof options.checkPremium === "function"
          ? await options.checkPremium()
          : await checkPremiumWeb();

    var storedHash = storedHashEarly;

    var localAdmin = Boolean(storedHash);
    var freeTierLocal = localAdmin && !premium;

    if (!premium && !localAdmin) {
      paywallEl.classList.remove("hidden");
      passInput.disabled = true;
      submitBtn.disabled = true;
      setMsg(msgEl, "Complete Haven setup first, or upgrade for cloud Portal Admin.", false);
      return { unlocked: false, premium: false };
    }

    if (freeTierLocal) {
      global.HAVEN_OPS_FREE_TIER = true;
      leadEl.textContent =
        "Free tier — local dashboard. Enter your setup master password. Cloud commands require ABXLIC1.";
    }

    var isSetup = !storedHash;
    if (isSetup) {
      titleEl.textContent = "Establish Guardian Password";
      leadEl.textContent =
        "Set a master password for the Portal Admin. This must match your extension options gate password.";
      submitBtn.textContent = "Set Password";
      passInput.placeholder = "Choose master password (min 8 chars)";
    } else {
      submitBtn.textContent = "Unlock";
    }

    if (webAuthnSupported()) {
      if (getStoredPasskeyId()) {
        passkeyBtn.classList.remove("hidden");
      }
      registerBtn.classList.remove("hidden");
    }

    async function finishUnlock() {
      markSessionUnlocked();
      if (freeTierLocal) {
        global.dispatchEvent(new CustomEvent("haven:ops:free-tier", { detail: { limited: true } }));
      }
      if (mode === "extension" && typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.sendMessage({ type: "haven-ops-session", unlocked: true }, function () {});
      }
      revealContent(overlay, root);
    }

    async function verifyPassword() {
      var value = (passInput.value || "").trim();
      if (!value) {
        setMsg(msgEl, "Enter a password.", false);
        return;
      }

      if (isSetup) {
        if (value.length < MIN_PASSWORD_LEN) {
          setMsg(msgEl, "Password must be at least " + MIN_PASSWORD_LEN + " characters.", false);
          return;
        }
        var newHash = await sha256Hex(value);
        if (mode === "extension") {
          await setExtensionHash(newHash);
        } else {
          setWebStoredHash(newHash);
        }
        setMsg(msgEl, "Master password established.", true);
        passInput.value = "";
        await finishUnlock();
        return;
      }

      var attempt = await sha256Hex(value);
      if (attempt === storedHash) {
        syncHashToSession(storedHash);
        setMsg(msgEl, "Access granted.", true);
        passInput.value = "";
        await finishUnlock();
        return;
      }

      setMsg(msgEl, "Invalid credentials. Access denied.", false);
      if (mode === "extension" && typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.sendMessage(
          { type: "haven-tamper-failed", count: 1, source: "ops_dashboard" },
          function () {}
        );
      }
    }

    submitBtn.addEventListener("click", function () {
      verifyPassword();
    });

    passInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        verifyPassword();
      }
    });

    passkeyBtn.addEventListener("click", async function () {
      try {
        passkeyBtn.disabled = true;
        await unlockWithPasskey();
        setMsg(msgEl, "Passkey verified.", true);
        await finishUnlock();
      } catch (e) {
        setMsg(msgEl, "Passkey unlock failed — use master password.", false);
      } finally {
        passkeyBtn.disabled = false;
      }
    });

    registerBtn.addEventListener("click", async function () {
      try {
        registerBtn.disabled = true;
        await registerPasskey("haven-parent-" + mode);
        passkeyBtn.classList.remove("hidden");
        setMsg(msgEl, "Passkey registered. Use it for one-tap unlock next time.", true);
      } catch (e) {
        setMsg(msgEl, "Passkey registration unavailable on this device.", false);
      } finally {
        registerBtn.disabled = false;
      }
    });

    return { unlocked: false, premium: true };
  }

  global.HavenOpsAuth = {
    init: init,
    sha256Hex: sha256Hex,
    webAuthnSupported: webAuthnSupported,
    isSessionUnlocked: isSessionUnlocked,
    STORAGE_PARENT_HASH: STORAGE_PARENT_HASH
  };
})(typeof window !== "undefined" ? window : globalThis);
