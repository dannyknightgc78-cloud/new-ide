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
 * TEMPORARY owner monitoring gate — 8-digit passcode only (no nginx basic auth / master password).
 * Passcode is verified client-side via SHA-256; unlock stored in localStorage (30-day TTL, stay signed in default on).
 */
(function (global) {
  "use strict";

  /* SHA-256("15051978") — passcode not stored in plaintext */
  var EXPECTED_HASH = "0d5f7a7565ebd7a90ccfc54a9a508f2a6285db0d91b4bf6d0e04137e84d82998";
  var STORAGE_OK = "haven.owner.passcodeOk";
  var STORAGE_HASH = "haven.owner.passcodeHash";
  var STORAGE_EXPIRY = "haven.owner.passcodeExpiry";
  var STORAGE_STAY = "haven.owner.staySignedIn";
  var TTL_MS = 30 * 24 * 60 * 60 * 1000;

  function storage() {
    try {
      localStorage.setItem("__haven_probe__", "1");
      localStorage.removeItem("__haven_probe__");
      return localStorage;
    } catch (e) {
      return null;
    }
  }

  function migrateFromSession() {
    try {
      if (sessionStorage.getItem(STORAGE_OK) === "1") {
        var h = sessionStorage.getItem(STORAGE_HASH) || EXPECTED_HASH;
        var store = storage();
        if (store) {
          store.setItem(STORAGE_OK, "1");
          store.setItem(STORAGE_HASH, h);
          store.setItem(STORAGE_STAY, "1");
          store.setItem(STORAGE_EXPIRY, String(Date.now() + TTL_MS));
        }
        sessionStorage.removeItem(STORAGE_OK);
        sessionStorage.removeItem(STORAGE_HASH);
      }
    } catch (e) {
      /* ignore */
    }
  }

  migrateFromSession();

  function staySignedInDefault() {
    var store = storage();
    if (!store) return true;
    var v = store.getItem(STORAGE_STAY);
    if (v === null || v === "") return true;
    return v === "1";
  }

  function isExpired() {
    var store = storage();
    if (!store) return true;
    var exp = Number(store.getItem(STORAGE_EXPIRY) || 0);
    if (!exp) return false;
    return Date.now() > exp;
  }

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

  function clearSession() {
    try {
      sessionStorage.removeItem(STORAGE_OK);
      sessionStorage.removeItem(STORAGE_HASH);
    } catch (e) {
      /* ignore */
    }
    var store = storage();
    if (store) {
      store.removeItem(STORAGE_OK);
      store.removeItem(STORAGE_HASH);
      store.removeItem(STORAGE_EXPIRY);
    }
  }

  function isUnlocked() {
    var store = storage();
    if (store && store.getItem(STORAGE_OK) === "1") {
      if (isExpired()) {
        clearSession();
        return false;
      }
      return true;
    }
    try {
      return sessionStorage.getItem(STORAGE_OK) === "1";
    } catch (e) {
      return false;
    }
  }

  function passcodeHash() {
    if (!isUnlocked()) return "";
    var store = storage();
    try {
      if (store && store.getItem(STORAGE_OK) === "1") {
        var h = store.getItem(STORAGE_HASH) || "";
        if (h) return h;
        store.setItem(STORAGE_HASH, EXPECTED_HASH);
        return EXPECTED_HASH;
      }
      var sh = sessionStorage.getItem(STORAGE_HASH) || "";
      if (sh) return sh;
      if (sessionStorage.getItem(STORAGE_OK) === "1") {
        sessionStorage.setItem(STORAGE_HASH, EXPECTED_HASH);
        return EXPECTED_HASH;
      }
    } catch (e) {
      /* ignore */
    }
    return "";
  }

  function markUnlocked(hash, staySignedIn) {
    var stay = staySignedIn !== false && staySignedInDefault();
    if (staySignedIn === true) stay = true;
    if (staySignedIn === false) stay = false;
    var store = storage();
    try {
      if (stay && store) {
        store.setItem(STORAGE_OK, "1");
        if (hash) store.setItem(STORAGE_HASH, hash);
        store.setItem(STORAGE_STAY, "1");
        store.setItem(STORAGE_EXPIRY, String(Date.now() + TTL_MS));
      } else if (store) {
        store.removeItem(STORAGE_OK);
        store.removeItem(STORAGE_HASH);
        store.removeItem(STORAGE_EXPIRY);
        store.setItem(STORAGE_STAY, "0");
      }
      sessionStorage.setItem(STORAGE_OK, "1");
      if (hash) sessionStorage.setItem(STORAGE_HASH, hash);
    } catch (e) {
      /* ignore — private mode / Safari quirks */
    }
  }

  function touchSession() {
    if (!isUnlocked()) return;
    if (!staySignedInDefault()) return;
    var store = storage();
    if (store && store.getItem(STORAGE_OK) === "1") {
      try {
        store.setItem(STORAGE_EXPIRY, String(Date.now() + TTL_MS));
      } catch (e) {
        /* ignore */
      }
    }
  }

  function blurRoot(root, on) {
    if (!root) return;
    root.classList.toggle("ops-auth-blurred", on);
    root.setAttribute("aria-hidden", on ? "true" : "false");
  }

  function buildOverlay(opts) {
    opts = opts || {};
    var title = opts.title || "Owner Access";
    var lead =
      opts.lead ||
      "Enter your 8-digit owner passcode to unlock monitoring. Temporary convenience gate — not for household admins.";
    var stayChecked = staySignedInDefault() ? " checked" : "";
    var overlay = document.createElement("div");
    overlay.id = "ownerPasscodeOverlay";
    overlay.className = "ops-auth-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "ownerPasscodeTitle");
    overlay.innerHTML =
      '<div class="ops-auth-card owner-passcode-card">' +
      '<div class="ops-auth-shield" aria-hidden="true">' +
      '<svg viewBox="0 0 32 32"><path d="M16 2 4 7v8c0 7 5 12 12 15 7-3 12-8 12-15V7z" fill="#00ffcc"/><path d="m11 16 3.5 3.5L22 12" stroke="#0a0f1a" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      "</div>" +
      '<h2 id="ownerPasscodeTitle">' +
      title +
      "</h2>" +
      '<p class="ops-auth-lead" id="ownerPasscodeLead">' +
      lead +
      "</p>" +
      '<label class="ops-auth-label" for="ownerPasscodeInput">Owner passcode</label>' +
      '<div class="ops-auth-row owner-passcode-row">' +
      '<input type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code" enterkeyhint="go" maxlength="8" id="ownerPasscodeInput" class="ops-auth-input owner-passcode-input" placeholder="8 digits" aria-describedby="ownerPasscodeMsg" />' +
      '<button type="button" id="ownerPasscodeSubmit" class="ops-auth-btn">Unlock</button>' +
      "</div>" +
      '<label class="ops-auth-stay"><input type="checkbox" id="ownerPasscodeStay" ' +
      stayChecked +
      ' /> Stay signed in (30 days)</label>' +
      '<p class="ops-auth-msg" id="ownerPasscodeMsg" aria-live="polite"></p>' +
      "</div>";
    return overlay;
  }

  function setMsg(el, text, ok) {
    if (!el) return;
    el.textContent = text || "";
    el.className = "ops-auth-msg" + (text ? (ok ? " ok" : " err") : "");
  }

  function reveal(overlay, root, eventName) {
    overlay.classList.add("ops-auth-exiting");
    blurRoot(root, false);
    document.body.classList.remove("ops-auth-locked");
    setTimeout(function () {
      overlay.remove();
      if (eventName) {
        global.dispatchEvent(new CustomEvent(eventName));
      }
    }, 420);
  }

  /**
   * Show passcode gate unless session already unlocked.
   * Returns Promise<{ unlocked: boolean, skipped?: boolean }>
   */
  function gate(options) {
    options = options || {};
    var root = options.contentRoot || document.body;
    var eventName = options.unlockEvent || "haven:owner:unlocked";

    if (isUnlocked()) {
      touchSession();
      blurRoot(root, false);
      global.dispatchEvent(new CustomEvent(eventName));
      return Promise.resolve({ unlocked: true, skipped: true });
    }

    if (document.getElementById("ownerPasscodeOverlay")) {
      return Promise.resolve({ unlocked: false, pending: true });
    }

    return new Promise(function (resolve) {
      document.body.classList.add("ops-auth-locked", "ops-dark");
      blurRoot(root, true);

      var overlay = buildOverlay(options);
      document.body.appendChild(overlay);

      var input = document.getElementById("ownerPasscodeInput");
      var submit = document.getElementById("ownerPasscodeSubmit");
      var stayBox = document.getElementById("ownerPasscodeStay");
      var msg = document.getElementById("ownerPasscodeMsg");

      function tryUnlock() {
        var value = (input.value || "").replace(/\D/g, "");
        if (value.length !== 8) {
          setMsg(msg, "Enter all 8 digits.", false);
          return;
        }
        var stay = stayBox ? stayBox.checked : true;
        sha256Hex(value).then(function (hash) {
          if (hash === EXPECTED_HASH) {
            markUnlocked(hash, stay);
            setMsg(msg, stay ? "Access granted — staying signed in." : "Access granted.", true);
            input.value = "";
            reveal(overlay, root, eventName);
            resolve({ unlocked: true });
          } else {
            setMsg(msg, "Incorrect passcode.", false);
            input.value = "";
            input.focus();
          }
        });
      }

      submit.addEventListener("click", tryUnlock);
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          tryUnlock();
        }
      });

      setTimeout(function () {
        if (input) input.focus();
      }, 120);
    });
  }

  function logout() {
    clearSession();
    try {
      sessionStorage.removeItem("haven.ops.unlocked");
      sessionStorage.removeItem("haven.adminToken");
    } catch (e) {
      /* ignore */
    }
  }

  global.HavenOwnerPasscodeAuth = {
    gate: gate,
    isUnlocked: isUnlocked,
    passcodeHash: passcodeHash,
    sha256Hex: sha256Hex,
    clearSession: clearSession,
    logout: logout,
    touchSession: touchSession,
    EXPECTED_HASH: EXPECTED_HASH,
    TTL_MS: TTL_MS
  };
})(typeof window !== "undefined" ? window : globalThis);
