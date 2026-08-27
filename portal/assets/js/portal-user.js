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
 * My Haven — calm portal with themes, photo backgrounds, session memory.
 */
(function () {
  "use strict";

  var auth = window.HavenPortalAuth;
  if (!auth) return;

  var THEMES = [
    "sanctuary", "aurora-sanctuary", "soft-ocean", "digital-sanctuary", "circular-glass",
    "morning-mist", "lavender-calm",
    "sunny-meadow", "cloud-nine", "cozy-cabin",
    "sunset-glow", "aurora-dream", "playground-fun",
  ];
  var DESIGN_MODES = ["soft-ocean", "sanctuary", "digital-sanctuary"];
  var LEGACY_THEMES = {
    ocean: "soft-ocean", forest: "sunny-meadow", space: "lavender-calm",
    sunset: "sunset-glow", aurora: "aurora-dream", playground: "playground-fun",
    "circular-glass": "sanctuary",
  };
  var STATE_KEY_PREFIX = "myhaven.state.";
  var THEME_KEY_PREFIX = "myhaven.theme.";
  var BG_KEY_PREFIX = "myhaven.background.";
  var DEVICE_KEY = "myhaven.device_id";
  var ORBIT_COLORS = [
    "#4a90a4", "#7ec8e3", "#5aab9a", "#8b7aab", "#c98a63",
    "#6b8299", "#7aab8a", "#b87a6a", "#4a7a94", "#9bb4c9",
  ];
  var ORBIT_RADIUS = { inner: 0.26, mid: 0.36, outer: 0.46 };
  var ORBIT_OFFSET = { inner: -90, mid: -45, outer: 0 };
  var CAT_RING_RADIUS = 38;
  var GLASS_RING_RADIUS = { inner: 22, mid: 32, outer: 42 };
  var GLASS_RING_CATS = {
    inner: ["email", "quick"],
    mid: ["socials", "social", "music_video"],
    outer: ["learning", "homework", "travel", "storage", "tools", "creativity", "space"],
  };
  var AURORA_BUBBLES = [
    { pos: "tl", glow: "#2b9bff", label: "Socials & Email", cats: ["socials", "social", "email"] },
    { pos: "tr", glow: "#f5c842", label: "Learning & Homework", cats: ["learning", "homework"] },
    { pos: "ml", glow: "#ff5722", label: "Music & Video", cats: ["music_video"] },
    { pos: "mr", glow: "#c44dff", label: "Tools & My Stuff", cats: ["creativity", "tools"] },
    { pos: "bc", glow: "#14bf96", label: "Tools & My Stuff", cats: ["travel", "storage", "homework"] },
  ];

  var state = { slug: "", data: null, continueUrl: "", presets: [] };

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s || "";
    return d.innerHTML;
  }

  function normalizeTheme(name) {
    var t = (name || "").toLowerCase();
    if (THEMES.indexOf(t) >= 0) return t;
    return LEGACY_THEMES[t] || "sanctuary";
  }

  function isSanctuaryTheme(name) {
    return normalizeTheme(name) === "digital-sanctuary";
  }

  function isSanctuaryUnified(name) {
    var t = normalizeTheme(name);
    return t === "sanctuary" || t === "circular-glass" || t === "aurora-sanctuary";
  }

  function isAuroraTheme(name) {
    return normalizeTheme(name) === "aurora-sanctuary";
  }

  function isCircularGlassTheme(name) {
    return isSanctuaryUnified(name);
  }

  function isDarkPortalTheme(name) {
    var t = normalizeTheme(name);
    return t === "digital-sanctuary" || t === "sanctuary" || t === "circular-glass" || t === "aurora-sanctuary";
  }

  function themeFromUrl() {
    try {
      var p = new URLSearchParams(window.location.search);
      return p.get("theme") || "";
    } catch (e) {
      return "";
    }
  }

  function designModeFor(theme) {
    var t = normalizeTheme(theme);
    if (t === "digital-sanctuary") return "digital-sanctuary";
    if (t === "sanctuary" || t === "circular-glass") return "sanctuary";
    return "soft-ocean";
  }

  function deviceId() {
    try {
      var id = localStorage.getItem(DEVICE_KEY);
      if (!id) {
        id = "d" + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem(DEVICE_KEY, id);
      }
      return id;
    } catch (e) {
      return "anon";
    }
  }

  function localStateKey() {
    return STATE_KEY_PREFIX + (state.slug || "default");
  }

  function themeKey() {
    return THEME_KEY_PREFIX + (state.slug || "default");
  }

  function bgKey() {
    return BG_KEY_PREFIX + (state.slug || "default");
  }

  function orgSlug() {
    try {
      var p = new URLSearchParams(window.location.search);
      var fromUrl = p.get("org") || p.get("slug");
      if (fromUrl) return fromUrl;
    } catch (e) {}
    var sess = auth.getSession();
    return sess && sess.org ? sess.org.slug : "";
  }

  function userKey() {
    var sess = auth.getSession();
    if (sess && sess.email) return sess.email;
    return "device:" + deviceId();
  }

  function presetById(id) {
    for (var i = 0; i < state.presets.length; i++) {
      if (state.presets[i].id === id) return state.presets[i];
    }
    return null;
  }

  function resolveBackgroundImage(bgId, portal, branding) {
    if (bgId === "org-photo") {
      var orgBg = portal.org_background || {};
      if (orgBg.image_url) return orgBg.image_url;
    }
    var preset = presetById(bgId);
    if (preset && preset.image_url) return preset.image_url;
    if (bgId === "soft-gradient" || !bgId) return "";
    var orgBg2 = portal.org_background || {};
    if (orgBg2.style === "photo" && orgBg2.image_url && !bgId) return orgBg2.image_url;
    return "";
  }

  function applyBackground(bgId, portal, branding) {
    var id = bgId || "soft-gradient";
    var imgUrl = resolveBackgroundImage(id, portal || {}, branding || {});
    if (imgUrl) {
      document.documentElement.style.setProperty("--mh-bg-image", "url(\"" + imgUrl.replace(/"/g, "") + "\")");
    } else {
      document.documentElement.style.removeProperty("--mh-bg-image");
    }
    try { localStorage.setItem(bgKey(), id); } catch (e) {}
    document.querySelectorAll(".mh-bg-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-pick") === id);
    });
    saveStateRemote({ background: id });
  }

  function applyAuroraBackground(theme) {
    if (isAuroraTheme(theme) || normalizeTheme(theme) === "sanctuary") {
      document.documentElement.style.removeProperty("--mh-bg-image");
    }
  }

  function applyTheme(name) {
    var t = normalizeTheme(name);
    document.documentElement.classList.add("mh-theme-transition");
    document.documentElement.setAttribute("data-theme", t);
    document.body.classList.toggle("mh-sanctuary-mode", isDarkPortalTheme(t));
    document.body.classList.toggle("mh-circular-glass-mode", isCircularGlassTheme(t));
    document.body.classList.toggle("mh-aurora-mode", isAuroraTheme(t) || isCircularGlassTheme(t));
    applyAuroraBackground(t);
    try { localStorage.setItem(themeKey(), t); } catch (e) {}
    document.querySelectorAll(".mh-design-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-pick") === designModeFor(t));
    });
    document.querySelectorAll(".mh-theme-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-pick") === t);
    });
    var navTheme = document.querySelector(".mh-nav-theme");
    if (navTheme) {
      navTheme.textContent = isDarkPortalTheme(t) ? "Switch to Soft Ocean" : "Switch to Digital Sanctuary";
      navTheme.onclick = function () {
        applyTheme(isDarkPortalTheme(t) ? "soft-ocean" : "sanctuary");
        var nav = $("mainNav");
        var menu = $("sanctuaryMenu");
        if (nav) nav.classList.remove("open");
        if (menu) menu.setAttribute("aria-expanded", "false");
      };
    }
    updateSanctuaryChrome(t);
    saveStateRemote({ theme: t });
    setTimeout(function () {
      document.documentElement.classList.remove("mh-theme-transition");
    }, 500);
  }

  function updateSanctuaryChrome(theme) {
    var dark = isDarkPortalTheme(theme);
    var sanctuary = isSanctuaryTheme(theme);
    var circular = isCircularGlassTheme(theme);
    var layout = $("sanctuaryLayout");
    var circularLayout = $("circularGlassLayout");
    var trusted = $("trustedSites");
    var hubIntro = document.querySelector(".mh-hub-intro");
    var hubCompact = document.querySelector(".mh-hub-compact");
    var brandTitle = $("brandTitle");
    var spacesEmpty = $("spacesEmpty");
    var locationBanner = $("locationBanner");
    var sectionBg = $("sectionBackground");
    var sectionAdd = $("sectionAdd");
    var sectionScrap = $("sectionScrapbook");
    var themePicker = $("themePicker");
    var sidebarToggle = $("circularSidebarToggle");

    if (layout) layout.classList.toggle("hidden", !sanctuary);
    if (circularLayout) circularLayout.classList.toggle("hidden", !circular);
    if (trusted) trusted.classList.toggle("hidden", dark);
    if (hubIntro) hubIntro.classList.toggle("hidden", dark);
    if (hubCompact) hubCompact.classList.toggle("hidden", dark);
    if (spacesEmpty) spacesEmpty.classList.toggle("hidden", dark);
    if (locationBanner) locationBanner.classList.toggle("hidden", dark);
    if (sectionBg) sectionBg.classList.toggle("hidden", dark);
    if (sectionAdd) sectionAdd.classList.toggle("hidden", dark);
    if (themePicker) themePicker.classList.toggle("hidden", dark);
    if (sidebarToggle) sidebarToggle.classList.toggle("hidden", !circular);
    if (sectionScrap) {
      if (dark && !sectionScrap.classList.contains("mh-scrap-open")) {
        sectionScrap.classList.add("hidden");
      } else if (!dark) {
        sectionScrap.classList.remove("hidden");
        sectionScrap.classList.remove("mh-scrap-open");
      }
    }
    var scrapWidget = $("scrapbookWidget");
    if (scrapWidget) {
      scrapWidget.classList.toggle("hidden", !circular);
    }

    document.querySelectorAll(".mh-sanctuary-only").forEach(function (el) {
      if (el.id === "signOutBtn") return;
      el.classList.toggle("hidden", !dark);
    });

    if (brandTitle) {
      if (isSanctuaryTheme(theme)) {
        brandTitle.innerHTML = 'Digital Sanctuary<span class="mh-brand-tagline">My Haven</span>';
      } else if (isCircularGlassTheme(theme)) {
        brandTitle.innerHTML = 'My Haven<span class="mh-brand-tagline">Aurora Sanctuary</span>';
      } else {
        brandTitle.textContent = "My Haven";
      }
    }

    if (dark) {
      startSanctuaryClock();
      if (state.data) {
        var portal = (state.data.portal) || {};
        if (sanctuary) renderSanctuaryHub(portal);
        if (circular) renderCircularGlassHub(portal);
      }
    }
  }

  function buildThemePicker(defaultTheme) {
    var box = $("themePicker");
    if (!box) return;
    box.innerHTML =
      '<div class="mh-design-toggle" role="group" aria-label="Design mode">' +
      DESIGN_MODES.map(function (mode) {
        var label = mode === "digital-sanctuary" ? "Grid Sanctuary"
          : mode === "sanctuary" ? "Digital Sanctuary" : "Soft Ocean";
        return '<button type="button" class="mh-design-btn" data-pick="' + mode + '">' + label + "</button>";
      }).join("") +
      "</div>";
    box.querySelectorAll(".mh-design-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        applyTheme(btn.getAttribute("data-pick"));
      });
    });
    var cont = (state.data && state.data.portal && state.data.portal.continue) || {};
    var saved = "";
    try { saved = localStorage.getItem(themeKey()) || ""; } catch (e) {}
    var urlTheme = themeFromUrl();
    var loginTheme = document.body.classList.contains("mh-login-mode")
      ? (document.documentElement.getAttribute("data-theme") || "aurora-sanctuary")
      : "";
    applyTheme(
      urlTheme || saved || loginTheme || cont.theme || defaultTheme || "aurora-sanctuary"
    );
  }

  function showLoader() {
    var el = $("portalLoader");
    if (el) el.classList.remove("hidden");
  }

  function hideLoader() {
    var el = $("portalLoader");
    if (el) el.classList.add("hidden");
  }

  function buildBackgroundGallery(portal, branding) {
    var section = $("sectionBackground");
    var box = $("backgroundGallery");
    if (!section || !box) return;

    if (!portal.allow_background_gallery) {
      section.classList.add("hidden");
      var orgBg = portal.org_background || {};
      if (orgBg.style === "photo" && orgBg.image_url) {
        applyBackground("org-photo", portal, branding);
      }
      return;
    }

    section.classList.remove("hidden");
    var presets = portal.background_presets || state.presets || [];
    var orgBg = portal.org_background || {};
    var html = presets.map(function (p) {
      var style = "";
      if (p.image_url) {
        style = ' style="background-image:url(\'' + esc(p.image_url) + '\')"';
      }
      return '<button type="button" class="mh-bg-btn" data-pick="' + esc(p.id) + '"' +
        ' data-label="' + esc(p.name) + '"' + style + ' aria-label="' + esc(p.name) + '"></button>';
    }).join("");

    if (orgBg.style === "photo" && orgBg.image_url) {
      html += '<button type="button" class="mh-bg-btn" data-pick="org-photo"' +
        ' data-label="Family photo"' +
        ' style="background-image:url(\'' + esc(orgBg.image_url) + '\')" aria-label="Family photo"></button>';
    }

    box.innerHTML = html;
    box.querySelectorAll(".mh-bg-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        applyBackground(btn.getAttribute("data-pick"), portal, branding);
      });
    });

    var cont = (portal.continue) || {};
    var saved = "";
    try { saved = localStorage.getItem(bgKey()) || ""; } catch (e) {}
    var themeNow = document.documentElement.getAttribute("data-theme") || "sanctuary";
    var darkDefault = isDarkPortalTheme(themeNow) ? "aurora-sky" : "soft-gradient";
    var defaultBg = cont.background || saved || darkDefault;
    if (defaultBg === "org-photo" && !(orgBg.image_url)) defaultBg = darkDefault;
    applyBackground(defaultBg, portal, branding);
  }

  function saveStateLocal(patch) {
    try {
      var raw = localStorage.getItem(localStateKey());
      var cur = raw ? JSON.parse(raw) : {};
      Object.assign(cur, patch);
      localStorage.setItem(localStateKey(), JSON.stringify(cur));
    } catch (e) {}
  }

  function saveStateRemote(patch) {
    if (!state.slug) return;
    var body = Object.assign({ user_key: userKey() }, patch);
    auth.api("/" + state.slug + "/portal/state", {
      method: "PATCH",
      body: body,
      headers: { "X-Haven-Device-Id": deviceId() },
    }).catch(function () {});
  }

  function rememberSection(sectionId) {
    saveStateLocal({ last_section: sectionId, scroll_y: window.scrollY });
    saveStateRemote({ last_section: sectionId, scroll_y: window.scrollY });
  }

  function restoreSession(data) {
    var cont = data.portal && data.portal.continue;
    var local = {};
    try {
      local = JSON.parse(localStorage.getItem(localStateKey()) || "{}");
    } catch (e) {}

    var lastUrl = (cont && cont.last_url) || local.last_url || "";
    var lastSection = (cont && cont.last_section) || local.last_section || "";
    var scrollY = (cont && cont.scroll_y) || local.scroll_y || 0;

    state.continueUrl = lastUrl;

    var btn = $("continueBtn");
    if (btn && lastUrl) {
      btn.classList.remove("hidden");
      btn.textContent = "▶ Continue where you left off";
      btn.onclick = function () {
        openLink(lastUrl, "continue");
      };
    }

    if (lastSection) {
      setTimeout(function () {
        var el = document.querySelector('[data-section="' + lastSection + '"]');
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        else if (scrollY) window.scrollTo(0, scrollY);
      }, 300);
    }
  }

  var ICON_COLORS = {
    facebook: "#1877f2", bluesky: "#0085ff", linkedin: "#0a66c2", threads: "#000000",
    mastodon: "#6364ff", gmail: "#ea4335", outlook: "#0078d4", proton: "#6d4aff",
    youtube: "#ff0000", spotify: "#1db954", vimeo: "#1ab7ea",
    khan: "#14bf96", coursera: "#0056d2", duolingo: "#58cc02",
    maps: "#34a853", expedia: "#ffc72c", tripadvisor: "#00af87",
    docs: "#4285f4", grammarly: "#15c39a", wikipedia: "#000000",
    drive: "#0f9d58", dropbox: "#0061ff", onedrive: "#0078d4",
    notion: "#000000", trello: "#0079bf", canva: "#00c4cc",
    adobe: "#ff0000", figma: "#a259ff", behance: "#1769ff",
    scrapbook: "#e91e8c", space: "#ffb74d", default: "#4a90a4",
  };

  function colorForLink(link) {
    var name = (link.name || "").toLowerCase();
    var url = (link.url || "").toLowerCase();
    if (name.indexOf("facebook") >= 0 || url.indexOf("facebook.com") >= 0) return ICON_COLORS.facebook;
    if (name.indexOf("bluesky") >= 0 || url.indexOf("bsky.app") >= 0) return ICON_COLORS.bluesky;
    if (name.indexOf("linkedin") >= 0 || url.indexOf("linkedin.com") >= 0) return ICON_COLORS.linkedin;
    if (name.indexOf("threads") >= 0 || url.indexOf("threads.net") >= 0) return ICON_COLORS.threads;
    if (name.indexOf("mastodon") >= 0 || url.indexOf("mastodon") >= 0) return ICON_COLORS.mastodon;
    if (name.indexOf("gmail") >= 0 || url.indexOf("mail.google") >= 0) return ICON_COLORS.gmail;
    if (name.indexOf("outlook") >= 0 || url.indexOf("outlook.live") >= 0) return ICON_COLORS.outlook;
    if (name.indexOf("proton") >= 0 || url.indexOf("proton.me") >= 0) return ICON_COLORS.proton;
    if (name.indexOf("youtube") >= 0 || url.indexOf("youtube.com") >= 0) return ICON_COLORS.youtube;
    if (name.indexOf("spotify") >= 0 || url.indexOf("spotify.com") >= 0) return ICON_COLORS.spotify;
    if (name.indexOf("vimeo") >= 0 || url.indexOf("vimeo.com") >= 0) return ICON_COLORS.vimeo;
    if (name.indexOf("khan") >= 0 || url.indexOf("khanacademy") >= 0) return ICON_COLORS.khan;
    if (name.indexOf("coursera") >= 0 || url.indexOf("coursera.org") >= 0) return ICON_COLORS.coursera;
    if (name.indexOf("duolingo") >= 0 || url.indexOf("duolingo.com") >= 0) return ICON_COLORS.duolingo;
    if (name.indexOf("maps") >= 0 || url.indexOf("maps.google") >= 0) return ICON_COLORS.maps;
    if (name.indexOf("expedia") >= 0 || url.indexOf("expedia.com") >= 0) return ICON_COLORS.expedia;
    if (name.indexOf("tripadvisor") >= 0 || url.indexOf("tripadvisor.com") >= 0) return ICON_COLORS.tripadvisor;
    if (name.indexOf("docs") >= 0 || url.indexOf("docs.google") >= 0) return ICON_COLORS.docs;
    if (name.indexOf("grammarly") >= 0 || url.indexOf("grammarly.com") >= 0) return ICON_COLORS.grammarly;
    if (name.indexOf("wikipedia") >= 0 || url.indexOf("wikipedia.org") >= 0) return ICON_COLORS.wikipedia;
    if (name.indexOf("drive") >= 0 || url.indexOf("drive.google") >= 0) return ICON_COLORS.drive;
    if (name.indexOf("dropbox") >= 0 || url.indexOf("dropbox.com") >= 0) return ICON_COLORS.dropbox;
    if (name.indexOf("onedrive") >= 0 || url.indexOf("onedrive") >= 0) return ICON_COLORS.onedrive;
    if (name.indexOf("notion") >= 0 || url.indexOf("notion.so") >= 0) return ICON_COLORS.notion;
    if (name.indexOf("trello") >= 0 || url.indexOf("trello.com") >= 0) return ICON_COLORS.trello;
    if (name.indexOf("canva") >= 0 || url.indexOf("canva.com") >= 0) return ICON_COLORS.canva;
    if (name.indexOf("adobe") >= 0 || url.indexOf("adobe.com") >= 0) return ICON_COLORS.adobe;
    if (name.indexOf("figma") >= 0 || url.indexOf("figma.com") >= 0) return ICON_COLORS.figma;
    if (name.indexOf("behance") >= 0 || url.indexOf("behance.net") >= 0) return ICON_COLORS.behance;
    if (link.category === "scrapbook") return ICON_COLORS.scrapbook;
    if (link.category === "space") return ICON_COLORS.space;
    return ICON_COLORS.default;
  }

  function iconGlyph(link) {
    if (link.icon) return link.icon;
    return "🔗";
  }

  function siteLogoInner(link, sizeClass, displaySize) {
    if (window.HavenSiteLogos) {
      return HavenSiteLogos.logoImgHtml(link, {
        className: sizeClass || "",
        displaySize: displaySize || (sizeClass === "mh-site-logo--bubble" ? 38 : 64),
      });
    }
    return '<span class="mh-orbit-glyph" aria-hidden="true">' + esc(iconGlyph(link)) + "</span>";
  }

  function orbitIconHtml(link, section) {
    var color = colorForLink(link);
    var cat = link.category || section || "trusted";
    return '<button type="button" class="mh-orbit-icon mh-has-logo" data-url="' + esc(link.url) + '" data-section="' +
      esc(section || cat) + '" data-category="' + esc(cat) + '" title="' + esc(link.name) + '"' +
      ' style="--mh-icon-color:' + color + '" aria-label="' + esc(link.name) + '">' +
      siteLogoInner(link) +
      '<span class="mh-orbit-label">' + esc(link.name) + '</span></button>';
  }

  var SITE_LINK_SEL = ".mh-orbit-icon, .mh-glass-orbit-icon, .mh-aurora-bubble-icon, .mh-s-icon, .mh-s-link";

  function bindOrbitIcons(root) {
    if (!root || root._siteLinksBound) return;
    root._siteLinksBound = true;
    root.addEventListener("click", function (e) {
      var btn = e.target.closest(SITE_LINK_SEL);
      if (!btn || !root.contains(btn)) return;
      e.preventDefault();
      e.stopPropagation();
      btn.classList.add("mh-icon-tap");
      setTimeout(function () { btn.classList.remove("mh-icon-tap"); }, 350);
      openLink(btn.getAttribute("data-url"), btn.getAttribute("data-section"));
    });
  }

  function updateScrapbookWidget() {
    if (window.HavenScrapbook && window.HavenScrapbook.refreshWidget) {
      window.HavenScrapbook.refreshWidget();
    }
  }

  function bindScrapbookWidget() {
    var addBtn = $("scrapWidgetAdd");
    var widget = $("scrapbookWidget");
    if (!addBtn || addBtn._bound) return;
    addBtn._bound = true;
    addBtn.addEventListener("click", function () {
      openLink("#scrapbook", "scrapbook");
      var photoInput = $("scrapPhotoInput");
      if (photoInput) photoInput.click();
    });
    if (widget) {
      widget.addEventListener("click", function (e) {
        if (e.target.closest(".mh-scrap-widget-add")) return;
        openLink("#scrapbook", "scrapbook");
      });
    }
  }

  function bindSanctuaryLinks(root) {
    bindOrbitIcons(root);
  }

  function placeOnRing(el, count, index, radiusPct) {
    var angle = (2 * Math.PI * index / Math.max(count, 1)) - Math.PI / 2;
    var x = 50 + Math.cos(angle) * radiusPct;
    var y = 50 + Math.sin(angle) * radiusPct;
    el.style.left = x + "%";
    el.style.top = y + "%";
  }

  function renderCategoryOrbit(catMeta, links) {
    if (!links || !links.length) return "";
    var catId = catMeta.id || "trusted";
    var iconsHtml = links.map(function (link) {
      return orbitIconHtml(link, catId);
    }).join("");
    return '<article class="mh-cat-card" data-section="' + esc(catId) + '">' +
      '<h3 class="mh-cat-title"><span class="mh-cat-emoji" aria-hidden="true">' + esc(catMeta.icon || "🔗") +
      '</span> ' + esc(catMeta.label || catId) + '</h3>' +
      '<div class="mh-cat-orbit" aria-label="' + esc(catMeta.label || catId) + ' sites">' +
      '<div class="mh-cat-ring" aria-hidden="true"></div>' +
      '<div class="mh-cat-center" aria-hidden="true">' + esc(catMeta.icon || "🔗") + '</div>' +
      '<div class="mh-cat-icons">' + iconsHtml + '</div></div></article>';
  }

  function layoutCategoryOrbits(root) {
    if (!root) return;
    root.querySelectorAll(".mh-cat-orbit").forEach(function (orbit) {
      var icons = orbit.querySelectorAll(".mh-orbit-icon");
      icons.forEach(function (icon, i) {
        placeOnRing(icon, icons.length, i, CAT_RING_RADIUS);
      });
    });
    bindOrbitIcons(root);
  }

  function renderMobileGrid(allLinks) {
    var grid = $("hubMobileGrid");
    if (!grid) return;
    if (!allLinks.length) {
      grid.innerHTML = "";
      grid.classList.add("hidden");
      return;
    }
    grid.classList.remove("hidden");
    grid.innerHTML = allLinks.map(function (item) {
      return '<div class="mh-orbit-icon-wrap">' + orbitIconHtml(item.link, item.section) + "</div>";
    }).join("");
    bindOrbitIcons(grid);
  }

  function sanctuaryIconBtn(link, section, index) {
    var color = colorForLink(link);
    var sizeClass = index === 1 ? " mh-s-icon--hero" : "";
    return '<button type="button" class="mh-s-icon mh-has-logo' + sizeClass + '" data-url="' + esc(link.url) +
      '" data-section="' + esc(section) + '" title="' + esc(link.name) +
      '" style="--mh-icon-color:' + color + '" aria-label="' + esc(link.name) +
      '">' + siteLogoInner(link, "mh-site-logo--card") + "</button>";
  }

  function renderSanctuaryCard(catMeta, links) {
    if (!links || !links.length) return "";
    var catId = catMeta.id || "trusted";
    var icons = links.slice(0, 3).map(function (link, i) {
      return sanctuaryIconBtn(link, catId, i);
    }).join("");
    return '<article class="mh-s-card" data-category="' + esc(catId) + '" data-search="' +
      esc((catMeta.label || catId) + " " + links.map(function (l) { return l.name; }).join(" ")) + '">' +
      '<h3 class="mh-s-card-title"><span aria-hidden="true">' + esc(catMeta.icon || "🔗") + "</span> " +
      esc(catMeta.label || catId) + "</h3>" +
      '<div class="mh-s-card-icons">' + icons + "</div></article>";
  }

  function renderSanctuarySidebarGroup(catMeta, links) {
    if (!links || !links.length) return "";
    var catId = catMeta.id || "trusted";
    var items = links.map(function (link) {
      var color = colorForLink(link);
      return '<li><button type="button" class="mh-s-link" data-url="' + esc(link.url) +
        '" data-section="' + esc(catId) + '" data-search="' + esc(link.name) +
        '" title="' + esc(link.name) + '" aria-label="' + esc(link.name) + '">' +
        '<span class="mh-s-favicon mh-has-logo" style="--mh-icon-color:' + color + '" aria-hidden="true">' +
        siteLogoInner(link, "mh-site-logo--sidebar") + "</span>" + esc(link.name) + "</button></li>";
    }).join("");
    return '<div class="mh-s-source-group" data-category="' + esc(catId) + '" data-search="' +
      esc((catMeta.label || catId) + " " + links.map(function (l) { return l.name; }).join(" ")) + '">' +
      "<h4>" + esc(catMeta.label || catId) + "</h4>" +
      '<ul class="mh-s-source-list">' + items + "</ul></div>";
  }

  function renderSanctuaryHub(portal) {
    var grid = $("sanctuaryGrid");
    var sidebar = $("sanctuarySources");
    if (!grid || !sidebar) return;

    var categories = portal.trusted_categories || [];
    var cards = [];
    var groups = [];

    categories.forEach(function (cat) {
      var links = (cat.links || []).filter(function (l) { return l.url && l.enabled !== false; });
      if (!links.length) return;
      cards.push(renderSanctuaryCard(cat, links));
      groups.push(renderSanctuarySidebarGroup(cat, links));
    });

    if (portal.scrapbook_enabled !== false) {
      var scrapMeta = { id: "scrapbook", label: "My Scrapbook", icon: "📔" };
      var scrapLink = {
        name: "My Scrapbook",
        url: "#scrapbook",
        icon: "📔",
        category: "scrapbook",
        enabled: true,
      };
      cards.push(renderSanctuaryCard(scrapMeta, [scrapLink]));
      groups.push(renderSanctuarySidebarGroup(scrapMeta, [scrapLink]));
    }

    grid.innerHTML = cards.join("") || '<p class="mh-empty">No trusted sites yet — ask a grown-up to add your favourites!</p>';
    sidebar.innerHTML = groups.join("") || '<p class="mh-empty">No trusted sources configured.</p>';

    bindSanctuaryLinks(grid);
    bindSanctuaryLinks(sidebar);
    applySanctuarySearch(($("sanctuarySearch") || {}).value || "");
  }

  function ringForCategory(catId) {
    if (GLASS_RING_CATS.inner.indexOf(catId) >= 0) return "inner";
    if (GLASS_RING_CATS.mid.indexOf(catId) >= 0) return "mid";
    return "outer";
  }

  function glassOrbitIconHtml(link, section, ring) {
    var color = colorForLink(link);
    var cat = link.category || section || "trusted";
    return '<button type="button" class="mh-orbit-icon mh-glass-orbit-icon mh-has-logo" data-ring="' + esc(ring) +
      '" data-url="' + esc(link.url) + '" data-section="' + esc(section || cat) +
      '" data-category="' + esc(cat) + '" data-search="' + esc(link.name) +
      '" title="' + esc(link.name) + '" style="--mh-icon-color:' + color +
      '" aria-label="' + esc(link.name) + '">' +
      siteLogoInner(link) +
      '<span class="mh-orbit-label">' + esc(link.name) + "</span></button>";
  }

  function layoutGlassOrbits(layer) {
    if (!layer) return;
    ["inner", "mid", "outer"].forEach(function (ringName) {
      var icons = layer.querySelectorAll('[data-ring="' + ringName + '"]');
      var radius = GLASS_RING_RADIUS[ringName];
      var offset = ORBIT_OFFSET[ringName] || 0;
      icons.forEach(function (icon, i) {
        var angle = (2 * Math.PI * i / Math.max(icons.length, 1)) - Math.PI / 2 + (offset * Math.PI / 180);
        var x = 50 + Math.cos(angle) * radius;
        var y = 50 + Math.sin(angle) * radius;
        icon.style.left = x + "%";
        icon.style.top = y + "%";
      });
    });
    bindOrbitIcons(layer);
  }

  function auroraBubbleIconHtml(link, section) {
    var color = colorForLink(link);
    return '<button type="button" class="mh-aurora-bubble-icon mh-has-logo" data-url="' + esc(link.url) +
      '" data-section="' + esc(section) + '" data-search="' + esc(link.name) +
      '" title="' + esc(link.name) + '" style="--mh-icon-color:' + color +
      '" aria-label="' + esc(link.name) + '">' + siteLogoInner(link, "mh-site-logo--bubble") + "</button>";
  }

  function renderAuroraBubble(bubbleDef, catMap) {
    var icons = [];
    bubbleDef.cats.forEach(function (catId) {
      var cat = catMap[catId];
      if (!cat || !cat.links) return;
      cat.links.forEach(function (link) {
        if (link.url && link.enabled !== false && icons.length < 5) {
          icons.push(auroraBubbleIconHtml(link, catId));
        }
      });
    });
    if (!icons.length) return "";
    return '<div class="mh-aurora-bubble mh-aurora-bubble--' + bubbleDef.pos + '" data-pos="' + bubbleDef.pos +
      '" style="--mh-bubble-glow:' + bubbleDef.glow + '">' +
      '<div class="mh-aurora-bubble-ring" aria-hidden="true"></div>' +
      '<h3 class="mh-aurora-bubble-label">' + esc(bubbleDef.label) + "</h3>" +
      '<div class="mh-aurora-bubble-icons">' + icons.join("") + "</div></div>";
  }

  function auroraConnectorSvg() {
    var positions = {
      tl: { x1: 50, y1: 50, x2: 22, y2: 18 },
      tr: { x1: 50, y1: 50, x2: 78, y2: 18 },
      ml: { x1: 50, y1: 50, x2: 14, y2: 48 },
      mr: { x1: 50, y1: 50, x2: 86, y2: 48 },
      bc: { x1: 50, y1: 50, x2: 50, y2: 82 },
    };
    var lines = Object.keys(positions).map(function (key) {
      var p = positions[key];
      return '<line x1="' + p.x1 + '%" y1="' + p.y1 + '%" x2="' + p.x2 + '%" y2="' + p.y2 + '%" />';
    }).join("");
    return '<svg class="mh-aurora-connectors" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' + lines + "</svg>";
  }

  function renderCircularGlassHub(portal) {
    var layer = $("glassOrbitLayer");
    var sidebar = $("circularSources");
    if (!layer) return;

    var catMap = {};
    var groups = [];
    var categories = portal.trusted_categories || [];

    categories.forEach(function (cat) {
      var links = (cat.links || []).filter(function (l) { return l.url && l.enabled !== false; });
      if (!links.length) return;
      catMap[cat.id] = { meta: cat, links: links };
      groups.push(renderSanctuarySidebarGroup(cat, links));
    });

    var html = auroraConnectorSvg() + '<div class="mh-aurora-bubbles" aria-label="Category bubbles">';
    AURORA_BUBBLES.forEach(function (bubble) {
      html += renderAuroraBubble(bubble, catMap);
    });
    html += "</div>";

    layer.innerHTML = html || '<p class="mh-empty mh-glass-empty">No trusted sites yet — ask a grown-up to add your favourites!</p>';
    if (sidebar) {
      sidebar.innerHTML = groups.join("") || '<p class="mh-empty">No trusted sources configured.</p>';
      bindSanctuaryLinks(sidebar);
    }

    bindOrbitIcons(layer);
    bindGlassHubCenter();
    applySanctuarySearch(($("sanctuarySearch") || {}).value || "");
    updateScrapbookWidget();
  }

  function bindGlassHubCenter() {
    var hub = $("glassHubCenter");
    if (!hub || hub._bound) return;
    hub._bound = true;
    hub.addEventListener("click", function () {
      if (state.continueUrl) {
        openLink(state.continueUrl, "continue");
        return;
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
      rememberSection("hub");
    });
  }

  function applySanctuarySearch(query) {
    var q = (query || "").trim().toLowerCase();
    document.querySelectorAll(".mh-s-card, .mh-s-source-group").forEach(function (el) {
      var hay = (el.getAttribute("data-search") || "").toLowerCase();
      var match = !q || hay.indexOf(q) >= 0;
      el.classList.toggle("filtered-out", !match);
    });
    document.querySelectorAll(".mh-s-link").forEach(function (el) {
      var hay = (el.getAttribute("data-search") || "").toLowerCase();
      var match = !q || hay.indexOf(q) >= 0;
      el.classList.toggle("filtered-out", !match);
    });
    document.querySelectorAll(".mh-glass-orbit-icon").forEach(function (el) {
      var hay = (el.getAttribute("data-search") || "").toLowerCase();
      var match = !q || hay.indexOf(q) >= 0;
      el.classList.toggle("filtered-out", !match);
    });
  }

  var clockTimer = null;

  function startSanctuaryClock() {
    var clock = $("sanctuaryClock");
    if (!clock) return;
    function tick() {
      var now = new Date();
      var h = now.getHours();
      var m = now.getMinutes();
      var text = (h % 12 || 12) + ":" + (m < 10 ? "0" : "") + m;
      clock.textContent = text;
      clock.setAttribute("datetime", now.toISOString());
    }
    tick();
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = setInterval(tick, 30000);
  }

  function bindSanctuaryControls() {
    var search = $("sanctuarySearch");
    if (search && !search._bound) {
      search._bound = true;
      search.addEventListener("input", function () {
        applySanctuarySearch(search.value);
      });
    }

    var menu = $("sanctuaryMenu");
    var nav = $("mainNav");
    if (menu && nav && !menu._bound) {
      menu._bound = true;
      menu.addEventListener("click", function () {
        var open = nav.classList.toggle("open");
        menu.setAttribute("aria-expanded", open ? "true" : "false");
      });
      document.addEventListener("click", function (e) {
        if (!nav.classList.contains("open")) return;
        if (nav.contains(e.target) || menu.contains(e.target)) return;
        nav.classList.remove("open");
        menu.setAttribute("aria-expanded", "false");
      });
    }

    if (nav && !nav._sanctuaryMenuBuilt) {
      nav._sanctuaryMenuBuilt = true;
      var themeItem = document.createElement("button");
      themeItem.type = "button";
      themeItem.className = "mh-nav-theme";
      themeItem.textContent = "Switch to Soft Ocean";
      themeItem.addEventListener("click", function () {
        applyTheme("soft-ocean");
        nav.classList.remove("open");
        if (menu) menu.setAttribute("aria-expanded", "false");
      });
      nav.appendChild(themeItem);
    }

    var profile = $("profileBtn");
    if (profile && !profile._bound) {
      profile._bound = true;
      profile.addEventListener("click", function () {
        var signOut = $("signOutBtn");
        if (signOut) signOut.click();
      });
    }

    var sidebarToggle = $("circularSidebarToggle");
    var circularSidebar = $("circularSidebar");
    if (sidebarToggle && circularSidebar && !sidebarToggle._bound) {
      sidebarToggle._bound = true;
      sidebarToggle.addEventListener("click", function () {
        var open = document.body.classList.toggle("mh-sidebar-open");
        circularSidebar.classList.toggle("open", open);
        sidebarToggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }
  }

  function renderHub(portal) {
    var categories = portal.trusted_categories || [];
    var container = $("trustedSites");
    var mobileItems = [];
    var hasSpaces = false;

    if (container) {
      var cards = [];
      categories.forEach(function (cat) {
        var links = (cat.links || []).filter(function (l) { return l.url && l.enabled !== false; });
        if (!links.length) return;
        if (cat.id === "space") hasSpaces = true;
        cards.push(renderCategoryOrbit(cat, links));
        links.forEach(function (l) { mobileItems.push({ link: l, section: cat.id }); });
      });

      var scrapbookOn = portal.scrapbook_enabled !== false;
      if (scrapbookOn) {
        var scrapLink = {
          name: "My Scrapbook",
          url: "#scrapbook",
          icon: "📔",
          category: "scrapbook",
          enabled: true,
        };
        cards.push(renderCategoryOrbit(
          { id: "scrapbook", label: "My Scrapbook", icon: "📔" },
          [scrapLink]
        ));
        mobileItems.push({ link: scrapLink, section: "scrapbook" });
      }

      container.innerHTML = cards.join("");
      layoutCategoryOrbits(container);
    }

    renderMobileGrid(mobileItems);

    var spacesEmpty = $("spacesEmpty");
    if (spacesEmpty) {
      spacesEmpty.classList.toggle("hidden", hasSpaces);
    }

    bindHubCenter();
    var theme = document.documentElement.getAttribute("data-theme");
    if (isSanctuaryTheme(theme)) {
      renderSanctuaryHub(portal);
    } else if (isCircularGlassTheme(theme)) {
      renderCircularGlassHub(portal);
    }
    updateScrapbookWidget();
  }

  function bindHubCenter() {
    var hub = $("hubCenter");
    if (!hub || hub._bound) return;
    hub._bound = true;
    hub.addEventListener("click", function () {
      if (state.continueUrl) {
        openLink(state.continueUrl, "continue");
        return;
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
      rememberSection("hub");
    });
  }

  function haversineM(lat1, lon1, lat2, lon2) {
    var R = 6371000;
    var p1 = lat1 * Math.PI / 180;
    var p2 = lat2 * Math.PI / 180;
    var dp = (lat2 - lat1) * Math.PI / 180;
    var dl = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dp / 2) * Math.sin(dp / 2) +
      Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function matchTrustedArea(lat, lng, areas) {
    var best = null;
    var bestDist = Infinity;
    for (var i = 0; i < (areas || []).length; i++) {
      var a = areas[i];
      if (a.lat == null || a.lng == null) continue;
      var radius = a.radius_m != null ? a.radius_m : 200;
      var dist = haversineM(lat, lng, a.lat, a.lng);
      if (dist <= radius && dist < bestDist) {
        best = a;
        bestDist = dist;
      }
    }
    return best ? { area: best, distance_m: bestDist } : null;
  }

  function showLocationBanner(text) {
    var banner = $("locationBanner");
    if (!banner) return;
    if (text) {
      banner.textContent = text;
      banner.classList.remove("hidden");
    } else {
      banner.classList.add("hidden");
    }
  }

  function reverseGeocodeCity(lat, lng) {
    var url = "https://nominatim.openstreetmap.org/reverse?format=json&lat=" +
      encodeURIComponent(lat) + "&lon=" + encodeURIComponent(lng) + "&zoom=10&addressdetails=1";
    return fetch(url, { headers: { Accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.address) return "";
        var a = data.address;
        return a.city || a.town || a.village || a.suburb || a.county || a.state || "";
      })
      .catch(function () { return ""; });
  }

  function detectLocation(data) {
    var areas = data.trusted_areas || [];
    var orgName = (data.org && data.org.name) || "Your Haven";
    var defaultLabel = "📍 " + orgName;

    if (!navigator.geolocation) {
      showLocationBanner(defaultLabel);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      function (pos) {
        var lat = pos.coords.latitude;
        var lng = pos.coords.longitude;
        var match = matchTrustedArea(lat, lng, areas);
        if (match) {
          var prefix = match.distance_m <= 50 ? "You're in: " : "Near: ";
          showLocationBanner("📍 " + prefix + match.area.name);
          return;
        }
        reverseGeocodeCity(lat, lng).then(function (city) {
          showLocationBanner(city ? "📍 Near: " + city : defaultLabel);
        });
      },
      function () {
        showLocationBanner(defaultLabel);
      },
      { timeout: 12000, maximumAge: 300000, enableHighAccuracy: false }
    );
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

  function showBlocked(msg) {
    var text = msg || blockedMessage("");
    var existing = document.querySelector(".mh-block-toast");
    if (existing) existing.remove();
    var toast = document.createElement("div");
    toast.className = "mh-block-toast";
    toast.setAttribute("role", "alert");
    toast.textContent = text;
    document.body.appendChild(toast);
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 4500);
  }

  function openLink(url, section) {
    if (!url) return;
    if (url === "#scrapbook") {
      rememberSection("scrapbook");
      var scrapSection = $("sectionScrapbook");
      if (scrapSection) {
        scrapSection.classList.remove("hidden");
        scrapSection.classList.add("mh-scrap-open");
      }
      if (window.HavenScrapbook) window.HavenScrapbook.open();
      return;
    }
    rememberSection(section || "hub");
    saveStateLocal({ last_url: url });
    saveStateRemote({ last_url: url, last_section: section || "hub" });

    auth.api("/" + state.slug + "/portal/check-url", {
      method: "POST",
      body: { url: url },
    }).then(function (res) {
      if (res.allowed) {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        showBlocked(blockedMessage(res.reason));
      }
    }).catch(function () {
      showBlocked("Could not verify that site — try again in a moment.");
    });
  }

  function renderPortal(data) {
    state.data = data;
    var portal = data.portal || {};
    var org = data.org || {};
    var branding = data.branding || {};
    state.presets = portal.background_presets || [];

    document.body.classList.remove("mh-login-mode");

    if ($("heroTitle")) {
      $("heroTitle").textContent = org.name || "My Haven";
    }
    if ($("heroSub")) {
      $("heroSub").textContent = branding.welcome_text ||
        "Digital Sanctuary — your calm, safe launchpad for school, friends, and favourite sites.";
    }

    hideLoader();

    var banner = $("overrideBanner");
    if (banner) {
      if (portal.adult_filter_override && portal.override_warning) {
        banner.textContent = "⚠️ Grown-up notice: " + portal.override_warning;
        banner.classList.remove("hidden");
      } else if (portal.adult_filter_override) {
        banner.textContent = "⚠️ Adult content filter is turned OFF by Admin Ops — browsing is less restricted.";
        banner.classList.remove("hidden");
      } else {
        banner.classList.add("hidden");
      }
    }

    buildThemePicker(portal.theme);
    buildBackgroundGallery(portal, branding);
    renderHub(portal);
    detectLocation(data);
    restoreSession(data);
    if (window.HavenScrapbook) {
      window.HavenScrapbook.init(state.slug, portal.scrapbook_enabled !== false);
    }
    initParallax();
  }

  function initParallax() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var layer = document.querySelector(".mh-parallax-layer");
    if (!layer) return;
    var ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var y = window.scrollY * 0.15;
        layer.style.transform = "translate3d(0," + y + "px,0)";
        ticking = false;
      });
    }, { passive: true });
  }

  function loadHome() {
    showLoader();
    return auth.api("/" + state.slug + "/portal/home", {
      headers: { "X-Haven-Device-Id": deviceId() },
    }).then(renderPortal).catch(function (e) {
      hideLoader();
      throw e;
    });
  }

  function bindAddUrl() {
    var form = $("addUrlForm");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var status = $("addUrlStatus");
      var url = (($("addUrlInput") || {}).value || "").trim();
      var name = (($("addUrlName") || {}).value || "").trim();
      if (!url) return;
      if (status) {
        status.className = "mh-status";
        status.textContent = "Sending…";
        status.classList.remove("hidden");
      }
      auth.api("/" + state.slug + "/portal/request-url", {
        method: "POST",
        body: { url: url, name: name, requested_by: userKey() },
        headers: { "X-Haven-Device-Id": deviceId() },
      }).then(function () {
        if (status) {
          status.className = "mh-status ok";
          status.textContent = "Request sent! A grown-up will review it soon.";
        }
        if ($("addUrlInput")) $("addUrlInput").value = "";
        if ($("addUrlName")) $("addUrlName").value = "";
        rememberSection("add");
      }).catch(function (err) {
        if (status) {
          status.className = "mh-status err";
          var msg = err.message || "Could not send request";
          if (msg === "adult_content_blocked") {
            msg = "That site isn't allowed — adult content is blocked.";
          }
          status.textContent = msg;
        }
      });
    });
  }

  function trackScroll() {
    var timer = null;
    window.addEventListener("scroll", function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        saveStateLocal({ scroll_y: window.scrollY });
      }, 400);
    }, { passive: true });
  }

  function bootstrapLoginChrome() {
    var gate = $("authGate");
    if (!gate || gate.classList.contains("hidden")) return;
    var urlTheme = themeFromUrl();
    applyTheme(urlTheme || "aurora-sanctuary");
    document.body.classList.add("mh-login-mode");
    var brandTitle = $("brandTitle");
    if (brandTitle) {
      brandTitle.innerHTML = 'My Haven<span class="mh-brand-tagline">Aurora Sanctuary</span>';
    }
  }

  function init() {
    state.slug = orgSlug();
    bootstrapLoginChrome();
    bindAddUrl();
    bindSanctuaryControls();
    bindScrapbookWidget();
    trackScroll();

    auth.bindAuthForm({
      mode: "user",
      onSuccess: function (sess) {
        state.slug = orgSlug() || state.slug;
        if ($("signOutBtn")) $("signOutBtn").classList.remove("hidden");
        loadHome();
      },
    });

    if (auth.bootstrapSessionFromUrl(function (sess) {
      state.slug = sess.org.slug || state.slug || orgSlug();
      if ($("signOutBtn")) $("signOutBtn").classList.remove("hidden");
      loadHome().catch(function (e) {
        var el = $("hubOrbit");
        if (el) el.innerHTML = '<p class="mh-status err">' + esc(e.message) + "</p>";
      });
    })) {
      return;
    }

    if (auth.tryResumeSession(function (sess) {
      state.slug = sess.org.slug || state.slug || orgSlug();
      if ($("signOutBtn")) $("signOutBtn").classList.remove("hidden");
      loadHome().catch(function (e) {
        var el = $("hubOrbit");
        if (el) el.innerHTML = '<p class="mh-status err">' + esc(e.message) + "</p>";
      });
    })) {
      return;
    }

    auth.ensureValidSession(function (sess) {
      state.slug = sess.org.slug || state.slug || orgSlug();
      if ($("signOutBtn")) $("signOutBtn").classList.remove("hidden");
      loadHome().catch(function (e) {
        var el = $("hubOrbit");
        if (el) el.innerHTML = '<p class="mh-status err">' + esc(e.message) + "</p>";
      });
    });

    if ($("signOutBtn")) {
      $("signOutBtn").addEventListener("click", function () {
        auth.signOut().then(function () { window.location.reload(); });
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
