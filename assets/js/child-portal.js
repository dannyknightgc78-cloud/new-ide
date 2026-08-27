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
 * Child device portal — loads admin allowlist links and opens allowed URLs
 * in protected Safari (iOS PWA) with ad/popup blocking via DNS profile.
 */
(function (global) {
  "use strict";

  var SESSION_KEY = "haven.child.portalSession";
  var PROFILE_KEY = "haven_ios_profile_v1";
  var SILENT_KEY = "haven_silent_setup_v1";
  var ORG_API = "/api/haven/org";
  var DL_VER = "2026071213";

  function esc(s) {
    if (global.Haven && global.Haven.esc) return global.Haven.esc(s);
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  function licenseToken() {
    try {
      return localStorage.getItem("haven_license_token") || sessionStorage.getItem("haven_license_token") || "";
    } catch (_e) {
      return "";
    }
  }

  function deviceSlot() {
    try {
      return new URLSearchParams(global.location.search).get("device")
        || localStorage.getItem("haven_device_slot")
        || "1";
    } catch (_e) {
      return "1";
    }
  }

  function deviceId() {
    try {
      return localStorage.getItem("haven.enrolledDeviceId") || ("dev-slot-" + deviceSlot());
    } catch (_e) {
      return "dev-slot-" + deviceSlot();
    }
  }

  function isIos() {
    var ua = navigator.userAgent || "";
    return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function isStandalonePwa() {
    if (navigator.standalone === true) return true;
    try {
      return global.matchMedia("(display-mode: standalone)").matches;
    } catch (_e) {
      return false;
    }
  }

  function isSilentMode() {
    try {
      return !!localStorage.getItem(SILENT_KEY)
        || document.documentElement.getAttribute("data-haven-silent") === "1";
    } catch (_e) {
      return false;
    }
  }

  function profileInstalled() {
    try {
      return localStorage.getItem(PROFILE_KEY) === "1";
    } catch (_e) {
      return false;
    }
  }

  function markProfileInstalled() {
    try { localStorage.setItem(PROFILE_KEY, "1"); } catch (_e) { /* ignore */ }
  }

  function contentFilterUrl() {
    var base = (global.HAVEN_CONFIG && global.HAVEN_CONFIG.siteBase) || global.location.origin;
    return String(base).replace(/\/+$/, "") + "/downloads/haven-content-filter.mobileconfig?v=" + DL_VER;
  }

  function apiFetch(path, opts) {
    opts = opts || {};
    var lic = licenseToken();
    var headers = Object.assign({
      "Content-Type": "application/json",
      Accept: "application/json",
    }, opts.headers || {});
    if (lic) headers["X-Haven-License"] = lic;
    if (opts.sessionToken) headers["X-Haven-Org-Session"] = opts.sessionToken;
    headers["X-Haven-Device-Id"] = deviceId();
    return fetch(ORG_API + path, {
      method: opts.method || "GET",
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok || j.ok === false) {
          var err = new Error((j && (j.detail || j.error)) || ("HTTP " + r.status));
          err.code = (j && j.error) || "";
          throw err;
        }
        return j;
      });
    });
  }

  function cacheSession(data) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
    } catch (_e) { /* ignore */ }
  }

  function readCachedSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var p = JSON.parse(raw);
      if (!p || !p.session_token || !p.org || !p.org.slug) return null;
      return p;
    } catch (_e) {
      return null;
    }
  }

  function ensureDeviceSession() {
    var cached = readCachedSession();
    if (cached) return Promise.resolve(cached);

    var lic = licenseToken();
    if (!lic) return Promise.reject(new Error("license_required"));

    return apiFetch("/provision", {
      method: "POST",
      body: { license_token: lic },
    }).then(function () {
      return apiFetch("/session/device", {
        method: "POST",
        body: { license_token: lic, device_id: deviceId(), device_slot: deviceSlot() },
      });
    }).then(function (res) {
      var payload = {
        session_token: res.session_token,
        org: res.org,
        role: res.role,
        expires_at: res.expires_at,
      };
      cacheSession(payload);
      return payload;
    });
  }

  function loadPortalHome() {
    return ensureDeviceSession().then(function (sess) {
      return apiFetch("/" + sess.org.slug + "/portal/home", {
        sessionToken: sess.session_token,
      }).then(function (data) {
        data._session = sess;
        return data;
      });
    });
  }

  function flattenLinks(portal) {
    var out = [];
    var cats = (portal && portal.trusted_categories) || [];
    cats.forEach(function (cat) {
      (cat.links || []).forEach(function (link) {
        if (!link.url || link.enabled === false) return;
        out.push({
          url: link.url,
          name: link.name || link.url,
          icon: link.icon || cat.icon || "🔗",
          category: cat.label || cat.id || "Sites",
        });
      });
    });
    return out;
  }

  function blockedMessage(reason) {
    if (reason === "adult_content_blocked") {
      return "That site is blocked for safety. Ask Admin Ops to review it.";
    }
    if (reason === "not_in_allowlist") {
      return "That site isn't on your allowed list yet — ask a grown-up to approve it in Admin Ops.";
    }
    return "This site isn't allowed — ask a grown-up if you think it should be.";
  }

  function showToast(msg, kind) {
    var existing = document.querySelector(".child-browse-toast");
    if (existing) existing.remove();
    var toast = document.createElement("div");
    toast.className = "child-browse-toast" + (kind ? (" child-browse-toast--" + kind) : "");
    toast.setAttribute("role", "status");
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, kind === "block" ? 4500 : 2800);
  }

  function openProtected(url) {
    if (!url) return;
    var ios = isIos();
    var standalone = isStandalonePwa();

    if (ios && standalone && !profileInstalled() && !isSilentMode()) {
      showToast("Install content filter for ad blocking.", "warn");
    }

    var a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 0);
  }

  function checkAndOpen(url) {
    return ensureDeviceSession().then(function (sess) {
      return apiFetch("/" + sess.org.slug + "/portal/check-url", {
        method: "POST",
        sessionToken: sess.session_token,
        body: { url: url },
      });
    }).then(function (res) {
      if (res.allowed) {
        openProtected(url);
      } else {
        showToast(blockedMessage(res.reason), "block");
      }
    }).catch(function () {
      showToast("Could not verify that site — try again in a moment.", "block");
    });
  }

  function renderProfileBanner(stage) {
    if (isSilentMode() || profileInstalled() || !isIos()) return "";
    return ""
      + '<p class="child-status-line child-status-line--setup" role="note">'
      + 'Parent: <a href="' + esc(contentFilterUrl()) + '">install content filter</a> for silent Safari blocking.'
      + "</p>";
  }

  function bindProfileBanner(stage) {
    /* setup hint is a one-line link — no dismiss button */
  }

  function silentStatusLine() {
    if (!isIos() && !isSilentMode()) return "";
    if (isSilentMode() || profileInstalled()) {
      return '<p class="child-status-line" role="status">Haven is protecting Safari.</p>';
    }
    return "";
  }

  function renderPortalLauncher(stage, portalData, childName) {
    var portal = portalData.portal || {};
    var org = portalData.org || {};
    var links = flattenLinks(portal);
    var hour = new Date().getHours();
    var greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    var name = childName || org.name || "";

    var tilesHtml = links.length
      ? links.map(function (link) {
        return ""
          + '<button type="button" class="tile tile--site" data-url="' + esc(link.url) + '" aria-label="' + esc(link.name) + '">'
          + '  <span class="ti-emoji">' + esc(link.icon) + '</span>'
          + '  <span class="ti-name">' + esc(link.name) + '</span>'
          + '  <span class="ti-cat">' + esc(link.category) + '</span>'
          + "</button>";
      }).join("")
      : '<p class="child-empty-links">No allowed sites yet — ask Admin Ops to add links in Portal Admin.</p>';

    stage.innerHTML = ""
      + renderProfileBanner(stage)
      + silentStatusLine()
      + '<div class="launcher">'
      + '  <div class="greeting">' + esc(greet) + (name ? ", " + esc(name) : "") + "</div>"
      + '  <p class="sub">Tap a site — opens in Safari with blocking on.</p>'
      + '  <div class="tiles tiles--portal">' + tilesHtml + "</div>"
      + "</div>";

    stage.querySelectorAll(".tile--site[data-url]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        checkAndOpen(btn.getAttribute("data-url") || "");
      });
    });
    bindProfileBanner(stage);
  }

  function updateExistingLauncher(stage, portalData, childName) {
    var portal = portalData.portal || {};
    var org = portalData.org || {};
    var links = flattenLinks(portal);
    var hour = new Date().getHours();
    var greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    var name = childName || org.name || "";

    var greeting = document.getElementById("greeting");
    var grid = document.getElementById("tileGrid");
    var sub = stage && stage.querySelector(".sub");
    if (greeting) greeting.textContent = greet + (name ? ", " + name : "");
    if (sub) sub.textContent = "Tap a site — opens in Safari with blocking on.";

    var statusEl = document.getElementById("silentStatus");
    if (statusEl && (isSilentMode() || profileInstalled())) statusEl.hidden = false;

    if (!grid) {
      renderPortalLauncher(stage, portalData, childName);
      return;
    }

    var banner = stage.querySelector(".child-status-line--setup");
    if (!banner && isIos() && !profileInstalled() && !isSilentMode()) {
      var wrap = document.createElement("div");
      wrap.innerHTML = renderProfileBanner(stage);
      var el = wrap.firstElementChild;
      if (el && stage.firstChild) stage.insertBefore(el, stage.firstChild);
      else if (el) stage.appendChild(el);
      bindProfileBanner(stage);
    }

    if (!links.length) {
      grid.innerHTML = '<p class="child-empty-links">No allowed sites yet — ask Admin Ops to add links in Portal Admin.</p>';
      return;
    }

    grid.className = "tiles tiles--portal";
    grid.innerHTML = links.map(function (link) {
      return ""
        + '<button type="button" class="tile tile--site" data-url="' + esc(link.url) + '">'
        + '<span class="ti-emoji">' + esc(link.icon) + '</span>'
        + '<span class="ti-name">' + esc(link.name) + '</span>'
        + '<span class="ti-cat">' + esc(link.category) + '</span>'
        + "</button>";
    }).join("");

    grid.querySelectorAll(".tile--site[data-url]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        checkAndOpen(btn.getAttribute("data-url") || "");
      });
    });
  }

  function loadAndRender(stage, childName) {
    if (!licenseToken()) {
      return Promise.resolve(false);
    }
    return loadPortalHome().then(function (data) {
      updateExistingLauncher(stage, data, childName);
      return true;
    }).catch(function (err) {
      if (err && err.code === "license_required") return false;
      return false;
    });
  }

  global.HavenChildPortal = {
    ensureDeviceSession: ensureDeviceSession,
    loadPortalHome: loadPortalHome,
    loadAndRender: loadAndRender,
    checkAndOpen: checkAndOpen,
    openProtected: openProtected,
    isSilentMode: isSilentMode,
    profileInstalled: profileInstalled,
    markProfileInstalled: markProfileInstalled,
    contentFilterUrl: contentFilterUrl,
    isIos: isIos,
    flattenLinks: flattenLinks,
  };
})(window);
