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
 * Haven platform download picker — Mac / Chrome / iOS / Android.
 * Fires cta_click analytics: { platform, source, action } → POST /api/haven/analytics/event
 */
(function (global) {
  "use strict";

  var DL_VER = "2026071712";
  var LICENSE_KEY = "haven_license_token";
  var WIZARD_DONE_KEY = "haven_download_wizard_v1";
  var _autoStarted = false;
  var _wizardOverlayEl = null;

  function urlParams() {
    try {
      return new URLSearchParams(global.location.search || "");
    } catch (_e) {
      return new URLSearchParams();
    }
  }

  function isAutorunForced() {
    var p = urlParams();
    return p.get("autorun") === "1" || p.get("run") === "1";
  }
  var ANDROID_APK_AVAILABLE = true;
  var ALL_PLATFORMS = ["safari", "mac", "chrome", "ios", "android"];
  var SITE = (global.HAVEN_CONFIG && global.HAVEN_CONFIG.siteBase)
    ? String(global.HAVEN_CONFIG.siteBase).replace(/\/+$/, "")
    : "https://haven.dannygc.cloud";

  function portalHubUrl(license) {
    var url = SITE + "/portal/?theme=aurora-sanctuary";
    if (license) url += "&license=" + encodeURIComponent(license);
    return url;
  }

  function vaultSetupNote(platform) {
    return "<p class=\"install-wizard-banner__vault\"><strong>Vault setup (required):</strong> After install, the wizard opens secure setup → set <em>master password</em> → download <code>haven-failsafe-keys.json</code> → pin the gold shield. Or open extension Options with <code>?setup=1</code>.</p>";
  }

  function dl(path, ver) {
    return SITE + "/downloads/" + encodeDownloadPath(path) + "?v=" + (ver || DL_VER);
  }

  function encodeDownloadPath(path) {
    return String(path || "").split("/").map(function (seg) {
      return encodeURIComponent(seg);
    }).join("/");
  }

  function rel(path, ver) {
    return "downloads/" + encodeDownloadPath(path) + "?v=" + (ver || DL_VER);
  }

  function normalizePlatform(id) {
    if (!id) return id;
    if (id === "windows" || id === "linux") return "chrome";
    return id;
  }

  function detectPlatform() {
    var ua = (global.navigator && global.navigator.userAgent) || "";
    var nav = global.navigator || {};
    if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
    if (nav.platform === "MacIntel" && nav.maxTouchPoints > 1) return "ios";
    if (/Android/i.test(ua)) return "android";
    if (/Windows/i.test(ua)) return "chrome";
    if (/Linux/i.test(ua)) return "chrome";
    if (/Macintosh|Mac OS X/i.test(ua)) {
      if (/Safari\//i.test(ua) && !/Chrome|Chromium|Edg\//i.test(ua)) return "safari";
      return "mac";
    }
    return "mac";
  }

  function detectBrowser() {
    var ua = (global.navigator && global.navigator.userAgent) || "";
    if (/Edg\//i.test(ua)) return "edge";
    if (/OPR\/|Opera/i.test(ua)) return "opera";
    if (/Chrome\//i.test(ua)) return "chrome";
    if (/Safari\//i.test(ua)) return "safari";
    if (/Firefox\//i.test(ua)) return "firefox";
    return "unknown";
  }

  function resolveLicense(opts) {
    opts = opts || {};
    if (opts.license) return opts.license;
    try {
      var p = new URLSearchParams(global.location.search || "");
      var lic = p.get("license") || p.get("license_token") || "";
      if (lic) return lic;
    } catch (_e) { /* ignore */ }
    try {
      return sessionStorage.getItem(LICENSE_KEY) || localStorage.getItem(LICENSE_KEY) || "";
    } catch (_e2) { return ""; }
  }

  function persistLicense(license) {
    if (!license) return;
    try {
      sessionStorage.setItem(LICENSE_KEY, license);
      localStorage.setItem(LICENSE_KEY, license);
      localStorage.setItem("haven_app_role", "parent");
    } catch (_e) { /* ignore */ }
  }

  function isWizardCompleted() {
    try { return !!localStorage.getItem(WIZARD_DONE_KEY); } catch (_e) { return false; }
  }

  function markWizardComplete() {
    try { localStorage.setItem(WIZARD_DONE_KEY, new Date().toISOString()); } catch (_e) { /* ignore */ }
  }

  function shouldAutoStart(opts) {
    opts = opts || {};
    if (opts.autoStart === false) return false;
    var p = urlParams();
    if (p.get("skip") === "1" || p.get("noauto") === "1") return false;
    if (isAutorunForced() || opts.forceAutorun) return true;
    if (p.get("all") === "1" || p.get("browse") === "1") return false;
    if (isWizardCompleted()) return false;
    return true;
  }

  function resolveAutorunPlatform(opts) {
    opts = opts || {};
    var p = urlParams();
    var explicit = normalizePlatform((p.get("platform") || "").toLowerCase());
    if (explicit) return explicit;
    var hash = normalizePlatform((global.location.hash || "").replace(/^#/, ""));
    if (hash) return hash;
    return normalizePlatform(opts.platform || detectPlatform());
  }

  function expandAutorunPanel(container, platform) {
    if (!container || !platform) return;
    var panel = container.querySelector('.platform-panel[data-platform="' + platform + '"]');
    if (panel) {
      panel.classList.add("platform-panel--autorun-active");
      panel.setAttribute("data-active", "true");
    }
    var banner = container.querySelector(".install-wizard-banner");
    if (banner) {
      banner.classList.add("install-wizard-banner--live");
      setTimeout(function () {
        try { banner.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch (_e) { /* ignore */ }
      }, 120);
    }
    if (panel) {
      setTimeout(function () {
        try { panel.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch (_e2) { /* ignore */ }
      }, 280);
    }
  }

  function triggerAutoDownload(url, platform, source, artifact) {
    if (!url) return;
    var a = global.document.createElement("a");
    a.href = url;
    a.setAttribute("download", "");
    a.style.display = "none";
    global.document.body.appendChild(a);
    setTimeout(function () {
      a.click();
      if (a.parentNode) a.parentNode.removeChild(a);
      trackDownloadClick(platform, source, { artifact: artifact, auto: true });
    }, 450);
  }

  function resolvePrimaryDownload(platform, license) {
    var ua = (global.navigator && global.navigator.userAgent) || "";
    var artifact = "";
    var url = "";
    if (platform === "safari") {
      url = withLicense(rel("haven-family-safari-mac.zip", DL_VER), license);
      artifact = "haven-family-safari-mac.zip";
    } else if (platform === "mac") {
      url = withLicense(rel("haven-family-chrome.zip", DL_VER), license);
      artifact = "haven-family-chrome.zip";
    } else if (platform === "android") {
      url = rel("haven-family-android.apk", DL_VER);
      artifact = "haven-family-android.apk";
    } else if (platform === "chrome") {
      if (/Windows/i.test(ua)) {
        url = withLicense(rel("haven-family-windows.zip", DL_VER), license);
        artifact = "haven-family-windows.zip";
      } else {
        url = withLicense(rel("haven-family-chrome.zip", DL_VER), license);
        artifact = "haven-family-chrome.zip";
      }
    }
    return { url: url, artifact: artifact };
  }

  function wizardStepDefs(platform, license, browser) {
    var extUrl = browser === "edge" ? "edge://extensions" : "chrome://extensions";
    var browserName = browser === "edge" ? "Microsoft Edge" : "Chrome";
    var licLine = license
      ? "<p class=\"haven-wizard__lic\"><strong>Premium license ready</strong> — auto-fills during setup.</p>"
      : "<p class=\"haven-wizard__lic muted\">Free tier works without a license. Paste ABXLIC1 in Options for premium vault.</p>";
    var vault = vaultSetupNote(platform);
    var hub = portalHubUrl(license);
    if (platform === "safari") {
      return {
        title: "Safari on Mac",
        intro: licLine + vault,
        steps: [
          { title: "Download Safari build", body: "Your <code>haven-family-safari-mac.zip</code> download should start automatically. Unzip it in Downloads." },
          { title: "Generate Xcode project", body: "Double-click <strong>haven-safari-build.command</strong> (or <strong>haven-safari-autorun.command</strong>) to open the generated Xcode project." },
          { title: "Run in Xcode", body: "Select <strong>Haven Family Extension (macOS)</strong> → click <strong>Run</strong> (▶)." },
          { title: "Enable in Safari", body: "Safari → <strong>Settings → Extensions</strong> → enable <strong>Haven Family</strong>. Unsigned build? <strong>Develop → Allow Unsigned Extensions</strong> first." },
          { title: "Finish vault setup", body: "Extension Options → <em>master password</em> → download <code>haven-failsafe-keys.json</code> → pin the gold shield. Optional: bookmark <a href=\"" + hub + "\">My Haven hub</a>." }
        ]
      };
    }
    if (platform === "mac") {
      return {
        title: "Mac — Chrome extension",
        intro: licLine + vault,
        steps: [
          { title: "Download Chrome zip", body: "Your <code>haven-family-chrome.zip</code> download should start automatically. Unzip in Downloads." },
          { title: "Run Install Haven", body: "Double-click <strong>Install Haven.command</strong> → native wizard opens → click <strong>Confirm setup</strong> when Haven is loaded." },
          { title: "Gatekeeper (DMG path only)", body: "If you use <code>haven-family-mac.dmg</code> instead: drag <strong>Haven</strong> to Applications → first launch: right-click <strong>Open</strong> (not notarized yet)." },
          { title: "Manual sideload fallback", body: "If auto-install is blocked: open <code>" + extUrl + "</code> → Developer mode → <strong>Load unpacked</strong> → select the <code>chrome</code> folder from the zip." },
          { title: "Finish vault setup", body: "Master password → save <code>haven-failsafe-keys.json</code> → pin gold shield. Optional hub: <a href=\"" + hub + "\">My Haven portal</a>." }
        ]
      };
    }
    if (platform === "android") {
      return {
        title: "Android",
        intro: licLine + vault,
        steps: [
          { title: "Download APK", body: "Your <code>haven-family-android.apk</code> download should start. Open it from Chrome or Files." },
          { title: "Allow install", body: "Tap <strong>Install</strong> when Android asks (one-time unknown-source approval)." },
          { title: "Launch & confirm", body: "Open Haven → tap <strong>Confirm setup</strong>. License from Admin Ops auto-fills — no kid license box." },
          { title: "Chrome extension (optional)", body: "Prefer Chrome extension? Unzip <code>haven-family-chrome.zip</code> → Chrome → <code>chrome://extensions</code> → Developer mode → <strong>Load unpacked</strong> → <code>chrome</code> folder. See <a href=\"help/load-extension.html\">Load unpacked help</a>." }
        ]
      };
    }
    return {
      title: browserName + " — Windows / Linux",
      intro: licLine + vault,
      steps: [
        { title: "Download installer zip", body: "Your zip download should start automatically (<code>haven-family-windows.zip</code> on Windows, <code>haven-family-chrome.zip</code> on Linux)." },
        { title: "Run Install Haven", body: "Unzip → double-click <strong>Install Haven</strong> (.bat on Windows, .sh on Linux) → follow the native wizard → <strong>Confirm setup</strong>." },
        { title: "Manual sideload", body: "Open <code>" + extUrl + "</code> → Developer mode ON → <strong>Load unpacked</strong> → select the <code>chrome</code> folder. Same zip works in Chrome and Edge." },
        { title: "Keep extension", body: "Chrome may warn the extension is not in the Web Store — click <strong>Keep extension</strong>. Haven is owner-built and safe until our store listing goes live." },
        { title: "Finish vault setup", body: "Master password → <code>haven-failsafe-keys.json</code> → pin gold shield. Need help? <a href=\"help/load-extension.html\">Load unpacked guide</a>." }
      ]
    };
  }

  function closeWizardOverlay() {
    if (_wizardOverlayEl && _wizardOverlayEl.parentNode) {
      _wizardOverlayEl.parentNode.removeChild(_wizardOverlayEl);
    }
    _wizardOverlayEl = null;
    global.document.body.classList.remove("haven-wizard-open");
  }

  function launchFullWizardOverlay(container, opts) {
    if (!global.document || !global.document.body) return;
    if (_wizardOverlayEl) return;
    opts = opts || {};
    var platform = resolveAutorunPlatform(opts);
    var browser = detectBrowser();
    var license = resolveLicense(opts);
    var source = opts.source || "downloads";
    var def = wizardStepDefs(platform, license, browser);
    var steps = def.steps || [];
    if (!steps.length) return;

    var current = 0;
    var downloadInfo = resolvePrimaryDownload(platform, license);
    var downloaded = false;

    var overlay = global.document.createElement("div");
    overlay.className = "haven-wizard-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "havenWizardTitle");
    overlay.innerHTML = ""
      + "<div class=\"haven-wizard-overlay__backdrop\" data-wizard-dismiss></div>"
      + "<div class=\"haven-wizard-overlay__panel\">"
      + "<button type=\"button\" class=\"haven-wizard-overlay__skip\" data-wizard-skip>Skip for now</button>"
      + "<div class=\"haven-wizard-overlay__head\">"
      + "<span class=\"haven-wizard-overlay__eyebrow\">Install wizard</span>"
      + "<h2 id=\"havenWizardTitle\" class=\"haven-wizard-overlay__title\"></h2>"
      + "<p class=\"haven-wizard-overlay__progress\" data-wizard-progress></p>"
      + "</div>"
      + "<div class=\"haven-wizard-overlay__intro\" data-wizard-intro></div>"
      + "<div class=\"haven-wizard-overlay__body\" data-wizard-body></div>"
      + "<div class=\"haven-wizard-overlay__actions\">"
      + "<button type=\"button\" class=\"btn btn-ghost btn-sm\" data-wizard-back hidden>Back</button>"
      + "<button type=\"button\" class=\"btn btn-primary\" data-wizard-next>Next</button>"
      + "</div></div>";
    global.document.body.appendChild(overlay);
    global.document.body.classList.add("haven-wizard-open");
    _wizardOverlayEl = overlay;

    var titleEl = overlay.querySelector("#havenWizardTitle");
    var progressEl = overlay.querySelector("[data-wizard-progress]");
    var introEl = overlay.querySelector("[data-wizard-intro]");
    var bodyEl = overlay.querySelector("[data-wizard-body]");
    var backBtn = overlay.querySelector("[data-wizard-back]");
    var nextBtn = overlay.querySelector("[data-wizard-next]");

    if (titleEl) titleEl.textContent = "Setting up Haven — " + def.title;
    if (introEl) introEl.innerHTML = def.intro || "";

    function renderStep() {
      var step = steps[current];
      if (progressEl) progressEl.textContent = "Step " + (current + 1) + " of " + steps.length;
      if (bodyEl) {
        bodyEl.innerHTML = "<h3 class=\"haven-wizard-step__title\">" + step.title + "</h3>"
          + "<div class=\"haven-wizard-step__body\">" + step.body + "</div>";
      }
      if (backBtn) backBtn.hidden = current === 0;
      if (nextBtn) {
        nextBtn.textContent = current === steps.length - 1 ? "Done — protection on" : "Next";
      }
      if (current === 0 && !downloaded && downloadInfo.url) {
        downloaded = true;
        triggerAutoDownload(downloadInfo.url, platform, source, downloadInfo.artifact);
      }
    }

    function finishWizard() {
      markWizardComplete();
      closeWizardOverlay();
      if (container) expandAutorunPanel(container, platform);
    }

    overlay.addEventListener("click", function (e) {
      var t = e.target;
      if (t && t.getAttribute && t.getAttribute("data-wizard-skip") != null) {
        markWizardComplete();
        closeWizardOverlay();
        return;
      }
      if (t && t.getAttribute && t.getAttribute("data-wizard-dismiss") != null) {
        closeWizardOverlay();
        return;
      }
      if (t && t.getAttribute && t.getAttribute("data-wizard-back") != null) {
        if (current > 0) { current -= 1; renderStep(); }
        return;
      }
      if (t && t.getAttribute && t.getAttribute("data-wizard-next") != null) {
        if (current < steps.length - 1) {
          current += 1;
          renderStep();
        } else {
          finishWizard();
        }
      }
    });

    renderStep();
    trackCta(platform, source, "full_wizard_open", { browser: browser, has_license: !!license, steps: steps.length });
    setTimeout(function () {
      try { overlay.querySelector(".haven-wizard-overlay__panel").focus(); } catch (_e) { /* ignore */ }
    }, 80);
  }

  function buildInstallWizardBanner(platform, license, browser) {
    var licNote = license
      ? "<p class=\"install-wizard-banner__lic\"><strong>Premium license ready</strong> — auto-fills during setup.</p>"
      : "<p class=\"install-wizard-banner__lic muted\">Free tier works without a license. Paste ABXLIC1 in Options for premium vault.</p>";
    var steps = "";
    if (platform === "safari") {
      steps = "<ol class=\"install-wizard-banner__steps\">"
        + "<li><strong>Safari zip download started</strong> — unzip <code>haven-family-safari-mac.zip</code>.</li>"
        + "<li>Double-click <strong>haven-safari-build.command</strong> (or <strong>haven-safari-autorun.command</strong>) → open the Xcode project it creates.</li>"
        + "<li>In Xcode: select <strong>Haven Family Extension (macOS)</strong> → <strong>Run</strong>.</li>"
        + "<li>Safari → <strong>Settings → Extensions</strong> → enable <strong>Haven Family</strong>. Shield shows <strong>Protected</strong> — silent background blocking.</li>"
        + "<li>Unsigned local build? Safari → <strong>Develop → Allow Unsigned Extensions</strong> first.</li>"
        + "<li><strong>Vault:</strong> master password → save <code>haven-failsafe-keys.json</code> → pin gold shield.</li>"
        + "<li><em>Optional:</em> Bookmark <a href=\"" + portalHubUrl(license) + "\">My Haven hub</a> for an all-in-one safe launcher — or browse Safari normally.</li></ol>";
    } else if (platform === "mac") {
      steps = "<ol class=\"install-wizard-banner__steps\">"
        + "<li><strong>Download started</strong> — unzip <code>haven-family-chrome.zip</code> from Downloads.</li>"
        + "<li>Double-click <strong>Install Haven.command</strong> → follow setup wizard → <strong>Confirm setup</strong>.</li>"
        + "<li><strong>DMG optional:</strong> <code>haven-family-mac.dmg</code> → drag to Applications → right-click <strong>Open</strong> if Gatekeeper blocks (not notarized yet).</li>"
        + "<li><strong>Vault:</strong> master password → save <code>haven-failsafe-keys.json</code> → pin gold shield.</li>"
        + "<li><em>Optional:</em> Bookmark <a href=\"" + portalHubUrl(license) + "\">My Haven hub</a> for categories, scrapbook, and trusted sites in one space.</li></ol>";
    } else if (platform === "android") {
      steps = "<ol class=\"install-wizard-banner__steps\">"
        + "<li><strong>APK download started</strong> — open from Chrome or Files.</li>"
        + "<li>Allow install once → tap <strong>Install</strong>.</li>"
        + "<li>Launch Haven → <strong>Confirm setup</strong>.</li>"
        + "<li><strong>Vault:</strong> master password → save <code>haven-failsafe-keys.json</code>.</li></ol>";
    } else {
      var extUrl = browser === "edge" ? "edge://extensions" : "chrome://extensions";
      var browserName = browser === "edge" ? "Microsoft Edge" : "Chrome";
      var ua = (global.navigator && global.navigator.userAgent) || "";
      var zipName = /Windows/i.test(ua) ? "haven-family-windows.zip" : "haven-family-chrome.zip";
      steps = "<ol class=\"install-wizard-banner__steps\">"
        + "<li><strong>Zip download started</strong> — unzip <code>" + zipName + "</code>.</li>"
        + "<li>Double-click <strong>Install Haven</strong> (.command / .bat / .sh) → native wizard opens.</li>"
        + "<li>Or sideload in <strong>" + browserName + "</strong>: open <code>" + extUrl + "</code> → Developer mode → <strong>Load unpacked</strong> → select the <code>chrome</code> folder.</li>"
        + "<li>Chrome may warn the extension is not in the Web Store — click <strong>Keep extension</strong>.</li>"
        + "<li><strong>Vault:</strong> wizard opens secure setup → master password → <code>haven-failsafe-keys.json</code> → pin shield.</li></ol>";
    }
    var el = global.document.createElement("div");
    el.className = "install-wizard-banner";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.innerHTML = "<div class=\"install-wizard-banner__inner\">"
      + "<span class=\"install-wizard-banner__eyebrow\">Install wizard</span>"
      + "<h3 class=\"install-wizard-banner__title\">Setting up Haven for your device</h3>"
      + licNote + vaultSetupNote(platform) + steps + "</div>";
    return el;
  }

  function autoStartInstallWizard(container, opts) {
    if (!container || !shouldAutoStart(opts)) return;
    if (_autoStarted && !opts.forceAutorun && !isAutorunForced()) return;
    _autoStarted = true;
    opts = opts || {};
    var license = resolveLicense(opts);
    persistLicense(license);
    var platform = resolveAutorunPlatform(opts);
    var browser = detectBrowser();
    var source = opts.source || "downloads";
    if (platform === "ios") {
      var iosQ = "platform=ios&install=1&device=1";
      if (license) iosQ += "&license=" + encodeURIComponent(license);
      var extra = urlParams().toString();
      if (extra) iosQ += "&" + extra;
      global.location.replace("/ios?" + iosQ);
      return;
    }

    var banner = buildInstallWizardBanner(platform, license, browser);
    var host = container.querySelector(".platform-picker") || container.firstElementChild;
    if (banner && host && host.parentNode) {
      host.parentNode.insertBefore(banner, host);
    } else if (banner) {
      container.insertBefore(banner, container.firstChild);
    }
    expandAutorunPanel(container, platform);
    launchFullWizardOverlay(container, {
      license: license,
      platform: platform,
      source: source
    });
    trackCta(platform, source, "auto_wizard", { browser: browser, has_license: !!license, autorun: isAutorunForced() });
  }

  function isIosDevice() {
    return detectPlatform() === "ios";
  }

  function isAndroidDevice() {
    return detectPlatform() === "android";
  }

  function isMacDesktop() {
    if (isIosDevice()) return false;
    var ua = (global.navigator && global.navigator.userAgent) || "";
    return /Macintosh|Mac OS X/i.test(ua);
  }

  function visiblePlatforms(opts) {
    opts = opts || {};
    if (opts.showAllPlatforms) return ALL_PLATFORMS.slice();
    var forced = normalizePlatform(opts.platform || "");
    if (forced && ALL_PLATFORMS.indexOf(forced) >= 0) return ALL_PLATFORMS.slice();
    if (isIosDevice()) return ["ios"];
    if (isAndroidDevice()) return ["android"];
    if (isMacDesktop()) return ["safari", "mac", "chrome", "ios", "android"];
    return ["mac", "chrome", "ios", "android"];
  }

  function trackCta(platform, source, action, extra) {
    var meta = { platform: platform, source: source || "downloads", action: action || "tab" };
    if (extra) {
      for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) meta[k] = extra[k];
    }
    if (global.HavenAnalytics && global.HavenAnalytics.track) {
      global.HavenAnalytics.track("cta_click", "cta_click", { metadata: meta });
    } else if (global.HavenAnalytics && global.HavenAnalytics.trackPlatformCta) {
      global.HavenAnalytics.trackPlatformCta(platform, source, action, extra);
    }
  }

  function trackDownloadClick(platform, source, extra) {
    trackCta(platform, source, "download", extra);
  }

  function withLicense(url, license) {
    if (!license || !url) return url;
    if (/^https?:\/\//.test(url) && url.indexOf(SITE) !== 0 && url.indexOf("downloads/") !== 0) return url;
    try {
      var base = /^https?:/.test(url) ? url : (global.location.origin + "/" + url.replace(/^\//, ""));
      var u = new URL(base);
      if (!u.searchParams.has("license")) u.searchParams.set("license", license);
      if (/^https?:/.test(url)) return u.pathname + u.search;
      return u.pathname.replace(/^\//, "") + u.search;
    } catch (_e) {
      return url;
    }
  }

  function wireBtn(el, platform, source, action, extra) {
    if (!el) return;
    el.addEventListener("click", function () {
      trackCta(platform, source, action || "download", extra);
    });
  }

  function chromeStoreActive() {
    var cfg = global.HAVEN_CONFIG || {};
    var published = cfg.chromeStorePublished === true;
    var ext = (typeof global.HAVEN_EXT !== "undefined" && global.HAVEN_EXT)
      ? global.HAVEN_EXT : null;
    if (ext && ext.CHROME_STORE_PUBLISHED === true) published = true;
    var url = String(cfg.chromeStoreUrl || (ext && ext.CHROME_STORE_URL) || "").trim();
    if (!published || !url) return "";
    return url;
  }

  function chromeInstallBlock(source) {
    var storeUrl = chromeStoreActive();
    if (!storeUrl) return "";
    return ""
      + "<div class=\"platform-chrome-store\">"
      + "<h4 class=\"platform-card-subtitle\">Chrome Web Store</h4>"
      + "<div class=\"platform-actions\">"
      + "<a class=\"btn btn-primary\" href=\"" + storeUrl + "\" target=\"_blank\" rel=\"noopener\" "
      + "data-haven-dl=\"chrome_store\">Install from Chrome Web Store</a>"
      + "</div>"
      + "<p class=\"muted\" style=\"font-size:0.85rem;margin:0.5rem 0 0\">"
      + "Prefer sideload? Use <strong>Load unpacked</strong> from the zip below.</p>"
      + "</div>";
  }

  function buildSafariPanel(license, source) {
    var safariZipUrl = withLicense(rel("haven-family-safari-mac.zip", DL_VER), license);
    var hubUrl = portalHubUrl(license);
    var onSafari = detectBrowser() === "safari" && isMacDesktop();
    var panel = document.createElement("div");
    panel.className = "platform-panel platform-card" + (onSafari ? " platform-panel--recommended" : "");
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("data-platform", "safari");
    panel.innerHTML = ""
      + "<h3 class=\"platform-card-title\">macOS — Safari (silent protection)</h3>"
      + "<div class=\"platform-ios-callout\" role=\"note\">"
      + "<strong>Hardly noticeable.</strong> Parent installs once — kid browses normal Safari. Haven blocks ads, popups, and adult domains in the background. Toolbar shield shows green <strong>Protected</strong> only."
      + "</div>"
      + (onSafari ? "<p class=\"platform-limit\"><strong>You are in Safari.</strong> Chrome zips do not apply — use this Safari build (Xcode required).</p>" : "")
      + "<p class=\"platform-limit\"><strong>Safari ≠ Chrome.</strong> Apple requires an Xcode app wrapper. Mac DMG covers Chrome only — this zip is the Safari path.</p>"
      + "<ol class=\"platform-steps platform-card-steps\">"
      + "<li><strong>One-click:</strong> <a href=\"/safari\">/safari</a> or download <code>haven-family-safari-mac.zip</code> below.</li>"
      + "<li>Double-click <strong>haven-safari-build.command</strong> — generates the Xcode project.</li>"
      + "<li>Xcode → <strong>Haven Family Extension (macOS)</strong> → <strong>Run</strong> → enable in Safari → Extensions.</li>"
      + "<li>Choose <strong>Free tier</strong> or paste ABXLIC1 in Options — license auto-fills from this page.</li>"
      + "<li><em>Optional:</em> Bookmark <a href=\"" + hubUrl + "\">My Haven hub</a> for all-in-one categories + scrapbook — or skip and browse Safari normally.</li>"
      + "</ol>"
      + "<div class=\"platform-actions\">"
      + "<a class=\"btn btn-primary" + (onSafari ? " platform-btn--recommended" : "") + "\" href=\"" + safariZipUrl + "\" download data-haven-dl=\"safari_zip\">Download free — Safari (.zip)</a>"
      + "<a class=\"btn btn-secondary btn-sm\" href=\"" + hubUrl + "\" data-haven-dl=\"safari_portal\">Open My Haven hub (optional)</a>"
      + "<a class=\"btn btn-secondary btn-sm\" href=\"install-guide.html#safari\" data-haven-dl=\"safari_guide\">Safari install guide</a>"
      + "</div>";
    wireBtn(panel.querySelector("[data-haven-dl=\"safari_zip\"]"), "safari", source, "download", { artifact: "haven-family-safari-mac.zip" });
    wireBtn(panel.querySelector("[data-haven-dl=\"safari_portal\"]"), "safari", source, "portal", { target: hubUrl });
    wireBtn(panel.querySelector("[data-haven-dl=\"safari_guide\"]"), "safari", source, "guide", { target: "install-guide.html#safari" });
    return panel;
  }

  function buildMacPanel(license, source) {
    var dmgUrl = withLicense(rel("haven-family-mac.dmg", DL_VER), license);
    var macZipUrl = withLicense(rel("haven-family-mac.zip", DL_VER), license);
    var chromeZipUrl = withLicense(rel("haven-family-chrome.zip", DL_VER), license);
    var hubUrl = portalHubUrl(license);
    var onMac = isMacDesktop();
    var panel = document.createElement("div");
    panel.className = "platform-panel platform-card" + (onMac ? " platform-panel--recommended" : "");
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("data-platform", "mac");
    panel.innerHTML = ""
      + "<h3 class=\"platform-card-title\">macOS — Chrome extension (silent)</h3>"
      + "<div class=\"platform-ios-callout\" role=\"note\">"
      + "<strong>Hardly noticeable.</strong> Chrome extension runs silently — ad/popup block, allowlist, green shield <strong>Protected</strong>. DMG helper is optional and does not hijack Safari."
      + "</div>"
      + (onMac ? "<p class=\"platform-limit\"><strong>Your Mac.</strong> Installs Haven for <strong>Google Chrome</strong> — not Safari. Use the <strong>Safari</strong> tab for Apple Safari.</p>" : "")
      + "<ol class=\"platform-steps platform-card-steps\">"
      + "<li><strong>Chrome zip (recommended):</strong> unzip → double-click <strong>Install Haven</strong> → silent protection ON.</li>"
      + "<li><strong>DMG (optional):</strong> open DMG → drag <strong>Haven</strong> to Applications → wizard installs Chrome extension.</li>"
      + "<li>Choose <strong>Free tier</strong> or paste ABXLIC1 in extension Options for premium vault and Portal Admin.</li>"
      + "<li><em>Optional:</em> Bookmark <a href=\"" + hubUrl + "\">My Haven hub</a> — all-in-one circular-glass launcher when you want it.</li>"
      + "</ol>"
      + "<div class=\"platform-actions\">"
      + "<a class=\"btn btn-primary" + (onMac ? " platform-btn--recommended" : "") + "\" href=\"" + chromeZipUrl + "\" download data-haven-dl=\"mac_chrome_zip\">Download free — Chrome (.zip)</a>"
      + "<a class=\"btn btn-secondary btn-sm\" href=\"" + dmgUrl + "\" download data-haven-dl=\"mac_dmg\">Download — Mac DMG (optional)</a>"
      + "<a class=\"btn btn-secondary btn-sm\" href=\"" + hubUrl + "\" data-haven-dl=\"mac_portal\">Open My Haven hub (optional)</a>"
      + "</div>";
    wireBtn(panel.querySelector("[data-haven-dl=\"mac_chrome_zip\"]"), "mac", source, "download", { artifact: "haven-family-chrome.zip" });
    wireBtn(panel.querySelector("[data-haven-dl=\"mac_dmg\"]"), "mac", source, "download", { artifact: "haven-family-mac.dmg" });
    wireBtn(panel.querySelector("[data-haven-dl=\"mac_portal\"]"), "mac", source, "portal", { target: hubUrl });
    return panel;
  }

  function buildChromePanel(license, source) {
    var chromeUrl = withLicense(rel("haven-family-chrome.zip", DL_VER), license);
    var winUrl = withLicense(rel("haven-family-windows.zip", DL_VER), license);
    var storeBlock = chromeInstallBlock(source);
    var browser = detectBrowser();
    var extPage = browser === "edge" ? "edge://extensions" : "chrome://extensions";
    var loadHelp = browser === "edge"
      ? "Edge: open <code>edge://extensions</code> → Developer mode → <strong>Load unpacked</strong> → select the <code>chrome</code> folder from the zip."
      : "Chrome: open <code>chrome://extensions</code> → Developer mode → <strong>Load unpacked</strong> → select the <code>chrome</code> folder.";
    var panel = document.createElement("div");
    panel.className = "platform-panel platform-card";
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("data-platform", "chrome");
    panel.innerHTML = ""
      + "<h3 class=\"platform-card-title\">Chrome, Edge, Brave — Windows &amp; Linux</h3>"
      + "<p class=\"platform-limit\"><strong>One zip, both browsers.</strong> <code>haven-family-chrome.zip</code> sideloads in Chrome <em>and</em> Microsoft Edge via Load unpacked.</p>"
      + (storeBlock || "")
      + "<ol class=\"platform-steps platform-card-steps\">"
      + "<li><strong>Chrome / Edge zip:</strong> unzip → double-click <strong>Install Haven</strong> → wizard → <strong>Confirm setup</strong> (Mac .command, Windows .bat, Linux .sh).</li>"
      + "<li><strong>Manual sideload:</strong> " + loadHelp + "</li>"
      + "<li><strong>Windows zip:</strong> includes extension + <strong>Install Haven.bat</strong> for Edge/Chrome on Windows.</li>"
      + "<li>Choose <strong>Free tier</strong> or paste ABXLIC1 — license auto-fills from this page when present.</li>"
      + "</ol>"
      + "<div class=\"platform-actions\">"
      + "<a class=\"btn btn-primary\" href=\"" + chromeUrl + "\" download data-haven-dl=\"chrome_zip\">Download free — Chrome / Edge (.zip)</a>"
      + "<a class=\"btn btn-secondary btn-sm\" href=\"" + winUrl + "\" download data-haven-dl=\"win_zip\">Download free — Windows (.zip)</a>"
      + "<a class=\"btn btn-secondary btn-sm\" href=\"help/load-extension.html\" data-haven-dl=\"chrome_help\">Load unpacked help (" + (browser === "edge" ? "Edge" : "Chrome") + ")</a>"
      + "<a class=\"btn btn-secondary btn-sm\" href=\"" + withLicense(rel("haven-native-setup.ps1", DL_VER), license) + "\" download data-haven-dl=\"win_script\">Windows setup (.ps1)</a>"
      + "<a class=\"btn btn-secondary btn-sm\" href=\"" + withLicense(rel("haven-native-setup-linux.sh", DL_VER), license) + "\" download data-haven-dl=\"linux_script\">Linux setup (.sh)</a>"
      + "<a class=\"btn btn-secondary btn-sm\" href=\"" + withLicense(rel("Install Haven.sh", DL_VER), license) + "\" download data-haven-dl=\"linux_install\">Install Haven (.sh)</a>"
      + "<a class=\"btn btn-secondary btn-sm\" href=\"" + withLicense(rel("Install Haven Extension.sh", DL_VER), license) + "\" download data-haven-dl=\"linux_ext_install\">Install Extension (.sh)</a>"
      + "</div>";
    wireBtn(panel.querySelector("[data-haven-dl=\"chrome_zip\"]"), "chrome", source, "download", { artifact: "haven-family-chrome.zip" });
    wireBtn(panel.querySelector("[data-haven-dl=\"win_zip\"]"), "chrome", source, "download", { artifact: "haven-family-windows.zip" });
    wireBtn(panel.querySelector("[data-haven-dl=\"chrome_help\"]"), "chrome", source, "guide", { target: "help/load-extension.html" });
    wireBtn(panel.querySelector("[data-haven-dl=\"win_script\"]"), "chrome", source, "download", { artifact: "haven-native-setup.ps1" });
    wireBtn(panel.querySelector("[data-haven-dl=\"linux_script\"]"), "chrome", source, "download", { artifact: "haven-native-setup-linux.sh" });
    wireBtn(panel.querySelector("[data-haven-dl=\"linux_install\"]"), "chrome", source, "download", { artifact: "Install Haven.sh" });
    wireBtn(panel.querySelector("[data-haven-dl=\"linux_ext_install\"]"), "chrome", source, "download", { artifact: "Install Haven Extension.sh" });
    var storeBtn = panel.querySelector("[data-haven-dl=\"chrome_store\"]");
    if (storeBtn) wireBtn(storeBtn, "chrome", source, "store", { target: "chrome_web_store" });
    return panel;
  }

  function buildIosPanel(source, license) {
    var isPaid = !!license && license.indexOf("ABXLIC1") !== -1;
    var mcUrl = withLicense(rel(isPaid ? "haven-ios.mobileconfig" : "haven-ios-free.mobileconfig", DL_VER), license);
    var filterUrl = rel("haven-content-filter.mobileconfig", DL_VER);
    var iosExtZip = rel("haven-family-ios-safari.zip", DL_VER);
    var blockerUrl = rel("ios-safari-content-blocker.json", DL_VER);
    var safariUrl = SITE + "/ios";
    var wizardUrl = "child.html?platform=ios&install=1&device=1";
    if (license) wizardUrl += "&license=" + encodeURIComponent(license);
    var hostLabel = SITE.replace(/^https?:\/\//, "");
    var licNote = license
      ? "<p class=\"muted\" style=\"font-size:.88rem;margin:0 0 .75rem\"><strong>Device 1 license ready</strong> — provisioned from Admin Ops link. Kid never sees a license box.</p>"
      : "<p class=\"muted\" style=\"font-size:.88rem;margin:0 0 .75rem\">Free tier: no license needed. Premium: open <code>/ios?license=ABXLIC1…</code> from Portal Admin (Device 1).</p>";
    var panel = document.createElement("div");
    panel.className = "platform-panel platform-card";
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("data-platform", "ios");
    panel.innerHTML = ""
      + "<h3 class=\"platform-card-title\">iPhone &amp; iPad — Safari Web Extension</h3>"
      + "<div class=\"platform-ios-callout\" role=\"note\">"
      + "<strong>Safari only on iPhone.</strong> Real Safari Web Extension + Content Blocker (ads, popups, adult domains) + GhostGrid allowlist. "
      + "<strong>Chrome on iPhone cannot host extensions</strong> — Apple requires WebKit; use Safari for Haven filtering."
      + "</div>"
      + licNote
      + "<div class=\"platform-visual-steps\">"
      + "<div class=\"pvs\"><span class=\"pvs-n\">1</span><span>Open <strong>" + hostLabel + "/ios</strong> in <strong>Safari</strong> (parent phone). License auto-fills from Admin Ops link.</span></div>"
      + "<div class=\"pvs\"><span class=\"pvs-n\">2</span><span><strong>TestFlight / Xcode:</strong> install <strong>Haven Family</strong> app → Settings → Safari → Extensions → enable <strong>Haven Family</strong> + <strong>Haven Content Blocker</strong>.</span></div>"
      + "<div class=\"pvs\"><span class=\"pvs-n\">3</span><span><strong>Or profile path:</strong> install <strong>content filter</strong> mobileconfig → blocks ads in Safari immediately (no App Store).</span></div>"
      + "<div class=\"pvs\"><span class=\"pvs-n\">4</span><span>Kid opens allowed sites in Safari — extension checks GhostGrid allowlist; content blocker strips ads/popups.</span></div>"
      + "</div>"
      + "<p class=\"muted\" style=\"font-size:.85rem;margin:.65rem 0 0\"><strong>iOS Chrome?</strong> Not supported — Chrome on iPhone uses WebKit and cannot load Haven extensions. Use Safari, or open allowed sites in Safari via Haven portal.</p>"
      + "<div class=\"platform-actions\">"
      + "<a class=\"btn btn-primary\" href=\"" + safariUrl + "\" data-haven-dl=\"ios_safari\">Open in Safari (/ios)</a>"
      + "<a class=\"btn btn-primary\" href=\"" + iosExtZip + "\" download data-haven-dl=\"ios_ext_zip\">Safari extension project (.zip)</a>"
      + "<a class=\"btn btn-secondary btn-sm\" href=\"" + filterUrl + "\" data-haven-dl=\"ios_filter\">Content filter profile</a>"
      + "<a class=\"btn btn-secondary btn-sm\" href=\"" + wizardUrl + "\" data-haven-dl=\"ios_wizard\">Portal launcher (optional)</a>"
      + "<a class=\"btn btn-secondary btn-sm\" href=\"" + mcUrl + "\" data-haven-dl=\"ios_profile\">Full profile (PWA + filter)"
      + (isPaid ? " (Premium)" : " (Free)") + "</a>"
      + "<a class=\"btn btn-secondary btn-sm\" href=\"" + blockerUrl + "\" data-haven-dl=\"ios_blocker\">blockRules.json</a>"
      + "</div>";
    wireBtn(panel.querySelector("[data-haven-dl=\"ios_safari\"]"), "ios", source, "guide", { target: safariUrl });
    wireBtn(panel.querySelector("[data-haven-dl=\"ios_ext_zip\"]"), "ios", source, "download", { artifact: "haven-family-ios-safari.zip" });
    wireBtn(panel.querySelector("[data-haven-dl=\"ios_wizard\"]"), "ios", source, "guide", { target: wizardUrl });
    wireBtn(panel.querySelector("[data-haven-dl=\"ios_filter\"]"), "ios", source, "download", { artifact: "haven-content-filter.mobileconfig" });
    wireBtn(panel.querySelector("[data-haven-dl=\"ios_profile\"]"), "ios", source, "download", { artifact: isPaid ? "haven-ios.mobileconfig" : "haven-ios-free.mobileconfig" });
    wireBtn(panel.querySelector("[data-haven-dl=\"ios_blocker\"]"), "ios", source, "download", { artifact: "ios-safari-content-blocker.json" });
    return panel;
  }

  function buildSovereignSelfhostBlock(license, source) {
    var lic = license || "YOUR_HAVEN_LICENSE";
    var selfhostUrl = withLicense(rel("haven-selfhost.zip", DL_VER), license);
    var block = document.createElement("div");
    block.className = "sovereign-selfhost sovereign-selfhost--inline";
    block.innerHTML = ""
      + "<div class=\"sovereign-selfhost-inner\">"
      + "<span class=\"pill pill-gold\">Sovereign Gold</span>"
      + "<h3 class=\"platform-card-title\">Run Haven on your own hardware</h3>"
      + "<p class=\"muted\" style=\"font-size:0.9rem;line-height:1.55;margin:0 0 0.75rem\">Unlimited household devices on hardware you control. Download the installer bundle and follow the setup guide with your Haven license.</p>"
      + "<div class=\"sovereign-shell\" aria-label=\"Sovereign self-host setup\">"
      + "<pre><span class=\"cmd-comment\"># Unzip and follow the included setup guide:</span>\n"
      + "<span class=\"cmd-line\">unzip haven-selfhost.zip</span>\n"
      + "<span class=\"cmd-line\"># Use license: " + String(lic).replace(/'/g, "&#39;") + "</span></pre>"
      + "</div>"
      + "<div class=\"platform-actions\">"
      + "<a class=\"btn btn-primary btn-sm\" href=\"" + selfhostUrl + "\" download data-haven-dl=\"sovereign_selfhost\">Download haven-selfhost.zip</a>"
      + "<a class=\"btn btn-secondary btn-sm\" href=\"setup.html\" data-haven-dl=\"sovereign_guide\">Full setup walkthrough</a>"
      + "</div></div>";
    wireBtn(block.querySelector("[data-haven-dl=\"sovereign_selfhost\"]"), "sovereign", source, "download", { artifact: "haven-selfhost.zip" });
    wireBtn(block.querySelector("[data-haven-dl=\"sovereign_guide\"]"), "sovereign", source, "guide", { target: "setup.html" });
    return block;
  }

  function buildAndroidPanel(source) {
    var panel = document.createElement("div");
    panel.className = "platform-panel platform-card platform-panel--recommended";
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("data-platform", "android");
    var chromeZip = rel("haven-family-chrome.zip", DL_VER);
    var apkBlock = "";
    if (ANDROID_APK_AVAILABLE) {
      var apkUrl = rel("haven-family-android.apk", DL_VER);
      apkBlock = ""
        + "<a class=\"btn btn-primary platform-btn--recommended\" href=\"" + apkUrl + "\" download data-haven-dl=\"android_apk\">Download Haven APK</a>";
    } else {
      apkBlock = "<span class=\"btn btn-primary btn-disabled\" aria-disabled=\"true\">APK — build on Mac/Linux with Android SDK</span>";
    }
    panel.innerHTML = ""
      + "<h3 class=\"platform-card-title\">Android — Chrome extension + APK</h3>"
      + "<div class=\"platform-ios-callout\" role=\"note\">"
      + "<strong>Chrome on Android supports extensions</strong> (Manifest V3) via sideload or enterprise policy. "
      + "Install <code>haven-family-chrome.zip</code> → Load unpacked in Chrome Android (chrome://extensions, Developer mode)."
      + "</div>"
      + "<div class=\"platform-visual-steps\">"
      + "<div class=\"pvs\"><span class=\"pvs-n\">1</span><span>Download <strong>haven-family-chrome.zip</strong> → unzip on device or transfer from desktop.</span></div>"
      + "<div class=\"pvs\"><span class=\"pvs-n\">2</span><span>Chrome → <code>chrome://extensions</code> → Developer mode → <strong>Load unpacked</strong> → select <code>chrome</code> folder.</span></div>"
      + "<div class=\"pvs\"><span class=\"pvs-n\">3</span><span>Or install <strong>Haven APK</strong> — WebView sanctuary with allowlist portal (no Chrome extension needed).</span></div>"
      + "<div class=\"pvs\"><span class=\"pvs-n\">4</span><span>License from Admin Ops (Device 1) — no kid license box.</span></div>"
      + "</div>"
      + "<div class=\"platform-actions\">"
      + "<a class=\"btn btn-primary\" href=\"" + chromeZip + "\" download data-haven-dl=\"android_chrome_zip\">Chrome extension (.zip)</a>"
      + apkBlock
      + "<a class=\"btn btn-secondary btn-sm\" href=\"install-guide.html#android\" data-haven-dl=\"android_guide\">Android install guide</a>"
      + "<a class=\"btn btn-secondary btn-sm\" href=\"help/load-extension.html\" data-haven-dl=\"android_help\">Load unpacked help</a>"
      + "</div>";
    wireBtn(panel.querySelector("[data-haven-dl=\"android_chrome_zip\"]"), "android", source, "download", { artifact: "haven-family-chrome.zip" });
    if (ANDROID_APK_AVAILABLE) {
      wireBtn(panel.querySelector("[data-haven-dl=\"android_apk\"]"), "android", source, "download", { artifact: "haven-family-android.apk" });
    }
    wireBtn(panel.querySelector("[data-haven-dl=\"android_guide\"]"), "android", source, "guide", { target: "install-guide.html#android" });
    wireBtn(panel.querySelector("[data-haven-dl=\"android_help\"]"), "android", source, "guide", { target: "help/load-extension.html" });
    return panel;
  }

  function renderPicker(container, opts) {
    if (!container) return;
    opts = opts || {};
    if (isAutorunForced()) {
      _autoStarted = false;
      opts.forceAutorun = true;
    }
    var source = opts.source || (/success\.html/i.test(global.location.pathname || "") ? "success" : "downloads");
    var license = resolveLicense(opts);
    opts.license = license;
    var detected = detectPlatform();
    var defaultPlatform = normalizePlatform(opts.platform || detected);
    var ids = visiblePlatforms({
      platform: opts.platform,
      showAllPlatforms: opts.showAllPlatforms === true
    });
    var builders = {
      safari: function () { return buildSafariPanel(license, source); },
      mac: function () { return buildMacPanel(license, source); },
      chrome: function () { return buildChromePanel(license, source); },
      ios: function () { return buildIosPanel(source, license); },
      android: function () { return buildAndroidPanel(source); }
    };

    var wrap = document.createElement("div");
    wrap.className = "platform-picker platform-picker--device-" + detected;
    if (ids.length === 1) wrap.className += " platform-picker--single";
    wrap.innerHTML = "<h2 class=\"platform-picker-title\">" + (ids.length === 1 ? "Install for your device" : "Pick your platform") + "</h2>";
    var tabs = document.createElement("div");
    tabs.className = "platform-tabs";
    tabs.setAttribute("role", "tablist");
    if (ids.length === 1) tabs.setAttribute("hidden", "hidden");
    wrap.appendChild(tabs);

    var browser = detectBrowser();
    var tabLabels = {
      safari: "Safari",
      mac: "Mac (Chrome)",
      chrome: browser === "edge" ? "Edge" : "Chrome / Edge",
      ios: "iOS",
      android: "Android"
    };
    var panels = {};

    ids.forEach(function (id) {
      var tab = document.createElement("button");
      tab.type = "button";
      tab.className = "platform-tab" + (id === detected ? " platform-tab--recommended" : "");
      tab.setAttribute("role", "tab");
      tab.setAttribute("data-platform", id);
      if (id === "android" && !ANDROID_APK_AVAILABLE) {
        tab.innerHTML = (tabLabels[id] || id) + " <span class=\"pill pill-gold platform-tab-soon\">Soon</span>";
      } else {
        tab.textContent = tabLabels[id] || id;
      }
      tabs.appendChild(tab);
      panels[id] = builders[id]();
      wrap.appendChild(panels[id]);
    });

    function activate(id) {
      id = normalizePlatform(id);
      if (ids.indexOf(id) < 0) id = ids[0] || detected;
      ids.forEach(function (pid) {
        var sel = pid === id;
        var tabEl = tabs.querySelector("[data-platform=\"" + pid + "\"]");
        if (tabEl) tabEl.setAttribute("aria-selected", sel ? "true" : "false");
        panels[pid].setAttribute("data-active", sel ? "true" : "false");
      });
      trackCta(id, source, "tab");
    }

    tabs.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-platform]");
      if (!btn) return;
      activate(btn.getAttribute("data-platform"));
    });

    var hash = normalizePlatform((global.location && global.location.hash || "").replace(/^#/, ""));
    if (hash && ids.indexOf(hash) >= 0) defaultPlatform = hash;
    if (ids.indexOf(defaultPlatform) < 0) defaultPlatform = ids[0] || detected;
    activate(defaultPlatform);

    if (String(opts.plan || "").toLowerCase() === "sovereign") {
      wrap.appendChild(buildSovereignSelfhostBlock(license, source));
    }

    container.innerHTML = "";
    container.appendChild(wrap);

    if (opts.autoStart !== false) {
      autoStartInstallWizard(container, {
        license: license,
        platform: defaultPlatform,
        source: source,
        plan: opts.plan || "",
        autoStart: opts.autoStart,
        forceAutorun: opts.forceAutorun
      });
      setTimeout(function () {
        if (!_autoStarted && shouldAutoStart(opts)) {
          _autoStarted = false;
          autoStartInstallWizard(container, {
            license: license,
            platform: defaultPlatform,
            source: source,
            plan: opts.plan || "",
            autoStart: true,
            forceAutorun: true
          });
        }
      }, 800);
    }
  }

  function autoInit() {
    document.querySelectorAll("[data-haven-platform-picker]").forEach(function (host) {
      renderPicker(host, {
        plan: host.getAttribute("data-plan") || "",
        license: host.getAttribute("data-license") || "",
        source: host.getAttribute("data-source") || "",
        platform: host.getAttribute("data-platform") || undefined
      });
    });
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", autoInit);
    } else {
      autoInit();
    }
  }

  global.HavenPlatformDownloads = {
    renderPicker: renderPicker,
    autoStartInstallWizard: autoStartInstallWizard,
    launchFullWizardOverlay: launchFullWizardOverlay,
    resolveLicense: resolveLicense,
    persistLicense: persistLicense,
    detectBrowser: detectBrowser,
    trackCta: trackCta,
    trackDownloadClick: trackDownloadClick,
    detectPlatform: detectPlatform,
    normalizePlatform: normalizePlatform,
    isIosDevice: isIosDevice,
    isAndroidDevice: isAndroidDevice,
    isMacDesktop: isMacDesktop,
    visiblePlatforms: visiblePlatforms,
    chromeStoreActive: chromeStoreActive,
    isWizardCompleted: isWizardCompleted,
    markWizardComplete: markWizardComplete,
    shouldAutoStart: shouldAutoStart,
    dl: dl,
    version: DL_VER
  };
})(typeof window !== "undefined" ? window : this);
