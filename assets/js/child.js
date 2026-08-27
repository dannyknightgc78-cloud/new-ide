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
   Haven — child device view (LIVE, transparent Visible Mentor)
   Reflects the REAL device state from the sidecar. Calm, reassuring
   copy when locked — never alarm styling, never covert. localStorage
   is only a last-known offline fallback.
   Pick the device with ?device=<id> (defaults to the first enrolled).
   ============================================================ */
(function () {
  "use strict";
  var H = window.Haven;
  var stage = document.getElementById("stage");
  var badge = document.getElementById("havenBadge");
  var badgeDot = document.getElementById("badgeDot");
  var badgeText = document.getElementById("badgeText");
  var clock = document.getElementById("clock");

  var deviceId = null;
  try { deviceId = new URLSearchParams(location.search).get("device"); } catch (e) {}

  var AppLaunch = window.HavenAppLaunch || {};
  var SETUP_KEY = AppLaunch.SETUP_KEY || "haven_pwa_setup_v1";
  var SILENT_KEY = "haven_silent_setup_v1";

  function isSilentMode() {
    try {
      return !!localStorage.getItem(SILENT_KEY)
        || document.documentElement.getAttribute("data-haven-silent") === "1";
    } catch (_e) {
      return false;
    }
  }

  function showSilentStatus() {
    var el = document.getElementById("silentStatus");
    if (el) el.hidden = false;
    if (document.documentElement.getAttribute("data-haven-mode") === "app") {
      document.documentElement.setAttribute("data-haven-silent", "1");
    }
  }

  function esc(s) {
    if (H && H.esc) return H.esc(s);
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  function isInstallMode() {
    if (AppLaunch.isInstallMode && AppLaunch.isInstallMode()) return true;
    try {
      return new URLSearchParams(location.search).get("install") === "1";
    } catch (_e) {
      return false;
    }
  }

  function isStandaloneApp() {
    if (AppLaunch.isStandalone && AppLaunch.isStandalone()) return true;
    return window.navigator.standalone === true;
  }

  function isIosSafari() {
    var ua = navigator.userAgent || "";
    var ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    return ios && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(ua);
  }

  function needsSetup() {
    if (isSilentMode()) return false;
    if (AppLaunch.needsSetup) return AppLaunch.needsSetup();
    try { return !localStorage.getItem(SETUP_KEY); } catch (_e) { return true; }
  }

  function markSetupComplete() {
    if (AppLaunch.markSetupComplete) AppLaunch.markSetupComplete();
    else {
      try { localStorage.setItem(SETUP_KEY, new Date().toISOString()); } catch (_e) { /* ignore */ }
    }
  }

  function persistLicenseFromUrl() {
    try {
      var p = new URLSearchParams(location.search);
      var lic = p.get("license") || p.get("license_token") || "";
      if (lic) {
        localStorage.setItem("haven_license_token", lic);
        sessionStorage.setItem("haven_license_token", lic);
        if (!isInstallMode() && !isStandaloneApp()) {
          localStorage.setItem("haven_app_role", "parent");
        }
      }
      var slot = p.get("device") || "1";
      localStorage.setItem("haven_device_slot", slot);
    } catch (_e) { /* ignore */ }
  }

  function deviceSlot() {
    try {
      return new URLSearchParams(location.search).get("device")
        || localStorage.getItem("haven_device_slot")
        || "1";
    } catch (_e) {
      return "1";
    }
  }

  async function enrollDeviceSlot() {
    if (!H || !H.api || !H.api.registerDevice) return;
    var slot = deviceSlot();
    var lic = "";
    try { lic = localStorage.getItem("haven_license_token") || ""; } catch (_e) {}
    var ua = navigator.userAgent || "";
    var label = /iPad/i.test(ua) ? "iPad PWA" : "iPhone PWA";
    try {
      var res = await H.api.registerDevice({
        id: "dev-slot-" + slot,
        child: "Device " + slot,
        device: label,
        emoji: "📱",
        agent: "haven-ios-pwa",
        license_token: lic || undefined
      });
      if (res && res.ok && res.data && res.data.device && res.data.device.id) {
        try { localStorage.setItem("haven.enrolledDeviceId", res.data.device.id); } catch (_e2) {}
      }
    } catch (_e3) { /* offline — setup still completes */ }
  }

  window.HavenChildEnroll = enrollDeviceSlot;

  function renderInstallWizard() {
    document.body.classList.add("install-mode");
    if (badgeText) badgeText.textContent = "Setup";
    var host = (window.HAVEN_CONFIG && window.HAVEN_CONFIG.siteBase) || "https://haven.dannygc.cloud";
    host = String(host).replace(/^https?:\/\//, "");
    stage.innerHTML =
      '<div class="install-wizard install-wizard--silent">' +
      '  <h1>Safari Web Extension setup</h1>' +
      '  <p class="install-lead">Real Safari extension + content blocker. License from Admin Ops (Device 1) — kid never sees a license box.</p>' +
      '  <div class="install-step">' +
      '    <div class="install-num">1</div>' +
      '    <div class="install-body"><h3>Install Haven Safari extension</h3>' +
      '    <p>Download <a href="downloads/haven-family-ios-safari.zip?v=2026071213"><strong>Safari extension project</strong></a> → Xcode → Run on iPhone → Settings → Safari → Extensions → enable <strong>Haven Family</strong>.</p></div></div>' +
      '  <div class="install-step">' +
      '    <div class="install-num">2</div>' +
      '    <div class="install-body"><h3>Enable content blocker</h3>' +
      '    <p>Settings → Safari → Content Blockers → <strong>Haven Content Blocker</strong> (blockRules.json: ads, popups, adult).</p></div></div>' +
      '  <div class="install-step">' +
      '    <div class="install-num">3</div>' +
      '    <div class="install-body"><h3>Or: DNS filter profile (no App Store)</h3>' +
      '    <p>Tap <a href="downloads/haven-content-filter.mobileconfig?v=2026071213"><strong>Install content filter</strong></a> → Settings → Allow.</p></div></div>' +
      '  <p class="install-note"><strong>iOS Chrome?</strong> Cannot host extensions — use Safari. Guide: <a href="ios-install.html"><strong>' + esc(host) + '/ios</strong></a></p>' +
      '</div>';
  }

  function renderSetupPrompt() {
    if (badgeText) badgeText.textContent = "Setup";
    stage.innerHTML =
      '<div class="setup-card">' +
      '  <svg class="calm-art" viewBox="0 0 32 32" aria-hidden="true" style="width:48px;height:48px;margin:0 auto 1rem">' +
      '    <path d="M16 2 4 7v8c0 7 5 12 12 15 7-3 12-8 12-15V7z" fill="#1f7a5c"/>' +
      '    <path d="m11 16 3.5 3.5L22 12" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '  <h1>Finish setup</h1>' +
      '  <p>Tap <strong>Confirm</strong> to enable silent Safari protection and open your site list.</p>' +
      '  <div class="setup-actions">' +
      '    <button type="button" class="btn btn-primary" id="confirmSetupBtn">Confirm</button>' +
      '  </div>' +
      '  <p class="btn-admin">Admin? <a href="ops.html">Portal Admin</a></p>' +
      '</div>';
    var btn = document.getElementById("confirmSetupBtn");
    if (btn) {
      btn.addEventListener("click", function () {
        enrollDeviceSlot();
        markSetupComplete();
        try { localStorage.setItem("haven_app_role", "child"); } catch (_e) {}
        if (badgeText) badgeText.textContent = "Protected";
        showSilentStatus();
        refresh();
        if (!window._havenRefreshTimer) {
          window._havenRefreshTimer = setInterval(refresh, H.cfg.pollMs || 4000);
        }
      });
    }
  }

  function tickClock() {
    if (clock) clock.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  setInterval(tickClock, 1000); tickClock();

  var DEFAULT_TILES = [
    { e: "📚", n: "Homework" }, { e: "🎨", n: "Create" },
    { e: "🎵", n: "Music" }, { e: "🧩", n: "Games" },
    { e: "📖", n: "Reading" }, { e: "🔭", n: "Explore" },
    { e: "✉️", n: "Messages" }, { e: "📷", n: "Photos" }
  ];
  /* DEFAULT_TILES retained for offline fallback reference only */

  function renderLauncher(childName) {
    var Portal = global.HavenChildPortal;
    if (Portal && Portal.loadAndRender && stage) {
      Portal.loadAndRender(stage, childName).then(function (loaded) {
        if (!loaded) renderLauncherFallback(childName);
      }).catch(function () {
        renderLauncherFallback(childName);
      });
      return;
    }
    renderLauncherFallback(childName);
  }

  function renderLauncherFallback(childName) {
    var hour = new Date().getHours();
    var greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    var greeting = document.getElementById("greeting");
    var grid = document.getElementById("tileGrid");
    if (greeting) greeting.textContent = greet + (childName ? ", " + childName : "");
    var sub = stage && stage.querySelector(".sub");
    if (sub) sub.textContent = "Protected and ready. Ask Admin Ops to add allowed sites.";
    if (grid) {
      grid.innerHTML = '<p class="child-empty-links">No allowed sites loaded — check your Haven license or ask Admin Ops.</p>';
      return;
    }
    stage.innerHTML =
      '<div class="launcher">' +
      '  <div class="greeting">' + esc(greet) + (childName ? ", " + esc(childName) : "") + '</div>' +
      '  <p class="sub">Protected and ready. Ask Admin Ops to add allowed sites.</p>' +
      '  <p class="child-empty-links">Portal links unavailable offline.</p>' +
      '</div>';
  }

  function renderCalm(childName, reason) {
    stage.innerHTML =
      '<div class="calm">' +
      '  <svg class="calm-art breathe" viewBox="0 0 120 120" aria-hidden="true">' +
      '    <circle cx="60" cy="60" r="52" fill="#eef3f1"/>' +
      '    <circle cx="60" cy="60" r="38" fill="#e4f1ea"/>' +
      '    <path d="M60 34 38 43v15c0 14 10 22 22 27 12-5 22-13 22-27V43z" fill="#1f7a5c"/>' +
      '    <path d="M60 58a6 6 0 0 0-3 11v6a3 3 0 0 0 6 0v-6a6 6 0 0 0-3-11z" fill="#fff"/>' +
      '  </svg>' +
      '  <h1>Connection paused for integrity maintenance</h1>' +
      '  <p>' + esc(childName ? childName + ", your" : "Your") +
      ' device is taking a short, planned pause while Haven verifies everything is healthy. Nothing is wrong, and nothing private was read. You\u2019ll be back online shortly.</p>' +
      '  <span class="calm-tag"><span class="dot" style="background:var(--gold)"></span> ' + esc(reason || "Awaiting verification") + '</span>' +
      '</div>';
  }

  function applyState(dev, online) {
    var locked = dev && dev.locked;
    if (badge) badge.classList.toggle("paused", !!locked);
    if (badgeDot) badgeDot.style.background = locked ? "var(--gold)" : "var(--verified)";
    if (badgeText) badgeText.textContent = locked ? "Paused"
      : online === false ? "Last known" : "Protected";
    if (locked) renderCalm(dev && dev.child, "Awaiting verification");
    else renderLauncher(dev && dev.child);
  }

  function pickDevice(devices) {
    if (!devices || !devices.length) return null;
    if (deviceId) { var m = devices.filter(function (d) { return d.id === deviceId; })[0]; if (m) return m; }
    return devices[0];
  }

  async function refresh() {
    if (!H || !H.api) {
      if (badgeText) badgeText.textContent = "Protected";
      renderLauncher(null);
      return;
    }
    try {
      var st = await H.api.state();
      H.cacheState(st);
      var dev = pickDevice(st.devices);
      if (!dev) {
        // No device enrolled yet — still transparent, just nothing to reflect.
        if (badgeText) badgeText.textContent = "Protected";
        showSilentStatus();
        renderLauncher(null);
        return;
      }
      applyState(dev, true);
    } catch (e) {
      // Offline: fall back to last-known state, clearly labelled.
      var last = H.lastState();
      var dev = last ? pickDevice(last.s.devices) : null;
      applyState(dev, false);
    }
  }

  persistLicenseFromUrl();
  var mode = document.documentElement.getAttribute("data-haven-mode") || "app";
  var nativeApp = false;
  try {
    var pq = new URLSearchParams(location.search);
    nativeApp = pq.get("native") === "1" || pq.get("source") === "ios-app" || pq.get("source") === "android-app"
      || localStorage.getItem("haven_native_app");
  } catch (_e) {}
  function bootApp() {
    if (badgeText) badgeText.textContent = "Protected";
    showSilentStatus();
    refresh();
    if (!window._havenRefreshTimer) {
      window._havenRefreshTimer = setInterval(refresh, (H && H.cfg && H.cfg.pollMs) || 4000);
    }
  }
  window.HavenChildBoot = bootApp;
  if (mode === "install" || mode === "setup") {
    if (mode === "setup" && badgeText) badgeText.textContent = nativeApp ? "Confirm" : "Setup";
    if (mode === "install" && badgeText) badgeText.textContent = "Setup";
    return;
  }
  var LicenseGate = window.HavenLicenseGate;
  if (LicenseGate && LicenseGate.requireValidLicense) {
    LicenseGate.requireValidLicense({ allowInstall: true, redirect: true }).then(bootApp).catch(function () {});
  } else {
    bootApp();
  }
})();
