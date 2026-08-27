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
 * My Haven portal org settings — embedded in ops.html (#portalAdmin).
 * Consolidated from /portal/admin.html (no duplicate admin surface).
 */
(function () {
  "use strict";

  var root = document.getElementById("portalAdmin");
  if (!root) return;

  var auth = window.HavenPortalAuth;
  if (!auth) return;

  var LEGACY_THEMES = {
    ocean: "soft-ocean", forest: "sunny-meadow", space: "lavender-calm",
    sunset: "sunset-glow", aurora: "aurora-dream", playground: "playground-fun",
  };
  var TRUSTED_CATEGORIES = [
    { id: "socials", label: "Socials", icon: "💬" },
    { id: "email", label: "Email", icon: "✉️" },
    { id: "music_video", label: "Music & Video", icon: "🎬" },
    { id: "learning", label: "Learning", icon: "📚" },
    { id: "travel", label: "Travel", icon: "✈️" },
    { id: "homework", label: "Homework / Study Tools", icon: "📝" },
    { id: "storage", label: "My Stuff", icon: "📦" },
    { id: "tools", label: "Tools", icon: "🛠️" },
    { id: "creativity", label: "Creativity", icon: "🎨" },
    { id: "space", label: "My Spaces", icon: "⭐" },
    { id: "quick", label: "Legacy Quick Links", icon: "⚡" },
    { id: "social", label: "Legacy Social", icon: "📱" },
  ];

  var state = { slug: "", org: null };
  var USER_PORTAL = "portal/index.html";

  function $(id) { return document.getElementById(id); }

  function setStatus(el, msg, ok) {
    if (!el) return;
    el.className = "portal-status " + (ok ? "ok" : "err");
    el.textContent = msg;
    el.classList.remove("hidden");
  }

  function showGate() {
    var gateEl = $("portalAdminAuthGate");
    var app = $("portalAdminApp");
    if (gateEl) gateEl.classList.remove("hidden");
    if (app) app.classList.add("hidden");
  }

  function hideGate() {
    var gateEl = $("portalAdminAuthGate");
    var app = $("portalAdminApp");
    if (gateEl) gateEl.classList.add("hidden");
    if (app) app.classList.remove("hidden");
  }

  function slugFromSession(sess) {
    return sess && sess.org && sess.org.slug ? sess.org.slug : "";
  }

  function redirectNonAdmin(sess) {
    window.location.href = USER_PORTAL + "?org=" + encodeURIComponent(sess.org.slug);
  }

  function onAuthed(sess) {
    if (sess.role !== "owner" && sess.role !== "admin_ops") {
      redirectNonAdmin(sess);
      return;
    }
    state.slug = slugFromSession(sess);
    hideGate();
    var so = $("portalAdminSignOutBtn");
    if (so) so.classList.remove("hidden");
    loadPortal();
  }

  function ensureSession() {
    var sess = auth.getSession();
    if (!sess || !sess.session_token) {
      showGate();
      return;
    }
    auth.api("/session/me").then(function (res) {
      auth.setSession({
        session_token: res.session_token,
        org: res.org,
        role: res.role,
        email: res.email,
        expires_at: res.expires_at,
        license_token: sess.license_token || "",
        license_validated: true,
      });
      onAuthed(auth.getSession());
    }).catch(function () {
      auth.clearSession();
      showGate();
    });
  }

  function bindAdminAuthForm() {
    var form = $("portalAdminAuthForm");
    var status = $("portalAdminAuthStatus");
    var licInput = $("portalAdminLicenseInput");
    var emailInput = $("portalAdminEmailInput");
    if (!form) return;

    if (licInput && auth.getLicenseToken()) {
      licInput.value = auth.getLicenseToken();
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = ((emailInput || {}).value || "").trim().toLowerCase();
      var lic = ((licInput || {}).value || auth.getLicenseToken() || "").trim();
      if (status) {
        status.className = "portal-status";
        status.textContent = "Validating license…";
        status.classList.remove("hidden");
      }
      auth.signIn(email, lic).then(function (res) {
        if (status) {
          status.className = "portal-status ok";
          status.textContent = "Signed in as " + res.email;
        }
        onAuthed(res);
      }).catch(function (err) {
        if (status) {
          status.className = "portal-status err";
          status.textContent = err.message || "Sign-in failed";
        }
      });
    });
  }

  function normalizeTheme(t) {
    t = (t || "").toLowerCase();
    if (t === "circular-glass") return "sanctuary";
    if (["sanctuary", "aurora-sanctuary", "soft-ocean", "digital-sanctuary", "circular-glass", "morning-mist", "lavender-calm", "sunny-meadow", "cloud-nine", "cozy-cabin", "sunset-glow", "aurora-dream", "playground-fun"].indexOf(t) >= 0) return t;
    return LEGACY_THEMES[t] || "aurora-sanctuary";
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s || "";
    return d.innerHTML;
  }

  function loadPortal() {
    return auth.api("").then(function (data) {
      state.org = data.org;
      state.slug = data.org.slug;
      state.trustedAreas = data.trusted_areas || [];
      renderBranding(data.branding || {});
      renderAreas(data.trusted_areas || []);
      if (data.members) renderMembers(data.members);
      var hero = $("heroPreview");
      if (hero && data.branding) {
        if (data.branding.hero_image_url) {
          hero.innerHTML = '<img src="' + esc(data.branding.hero_image_url) + '" alt="Hero" />' +
            '<div class="portal-hero-overlay"><h3>' + esc(data.org.name) + '</h3>' +
            '<p>' + esc(data.branding.welcome_text || "") + '</p></div>';
        } else {
          hero.innerHTML = '<div class="portal-hero-overlay" style="position:relative;min-height:160px">' +
            '<h3>' + esc(data.org.name) + '</h3>' +
            '<p>' + esc(data.branding.welcome_text || "") + '</p></div>';
        }
      }
      var roleEl = $("roleBadge");
      if (roleEl) roleEl.textContent = (data.role || "admin") + " · " + (data.email || "");
      return loadPortalAdmin();
    });
  }

  function loadPortalAdmin() {
    return auth.api("/" + state.slug + "/portal/home").then(function (data) {
      var portal = data.portal || {};
      if (portal.settings) renderPortalSettings(portal.settings, data.branding || {});
      else renderPortalSettings({ theme: portal.theme }, data.branding || {});
      renderAccessRules(portal, data.trusted_areas || state.trustedAreas || []);
      renderLinks(portal.all_links || []);
      renderRequests(portal.url_requests || []);
    });
  }

  function renderAccessRules(portal, areas) {
    var box = $("accessRulesSummary");
    if (!box) return;
    var rules = portal.access_rules || {};
    var links = portal.all_links || [];
    var enabled = links.filter(function (l) { return l.enabled; }).length;
    var pending = (portal.pending_requests || []).length;
    var allowedCount = rules.allowed_count != null ? rules.allowed_count : enabled;
    var byCat = rules.by_category || {};
    var catBits = Object.keys(byCat).map(function (k) { return k + ": " + byCat[k]; }).join(" · ");

    box.innerHTML =
      '<div class="access-rules-stats">' +
      '<div class="access-stat"><span class="access-stat-num">' + allowedCount + '</span><span class="access-stat-label">Allowed URLs</span></div>' +
      '<div class="access-stat"><span class="access-stat-num">' + enabled + '</span><span class="access-stat-label">Links shown</span></div>' +
      '<div class="access-stat"><span class="access-stat-num">' + (areas || []).filter(function (a) { return a.active !== false; }).length + '</span><span class="access-stat-label">Trusted areas</span></div>' +
      '<div class="access-stat"><span class="access-stat-num">' + pending + '</span><span class="access-stat-label">Pending requests</span></div>' +
      '</div>' +
      (catBits ? '<p class="access-rules-cats">' + esc(catBits) + '</p>' : '') +
      '<p class="access-rules-note">Toggle links below to allow or block. Pending kid requests stay blocked until you approve them.</p>';

    var warn = $("overrideActiveWarn");
    if (warn) {
      if (rules.adult_filter_override) {
        var msg = portal.override_warning || (portal.settings && portal.settings.override_warning_text) ||
          "Adult content filter is OFF — less safe browsing.";
        warn.textContent = "⚠️ Override active: " + msg;
        warn.classList.remove("hidden");
      } else {
        warn.classList.add("hidden");
      }
    }

    var areaList = $("accessAreaList");
    if (!areaList) return;
    if (!areas || !areas.length) {
      areaList.innerHTML = '<li class="area-item"><span class="meta">No trusted areas — add them below to show location context in the kid portal.</span></li>';
      return;
    }
    areaList.innerHTML = areas.map(function (a) {
      var loc = a.address || (a.lat != null ? a.lat + ", " + a.lng + " (" + (a.radius_m || 200) + "m)" : "No coordinates");
      return '<li class="area-item"><div><div class="name">' + esc(a.name) + '</div>' +
        '<div class="meta">' + esc(a.description || loc) + '</div></div>' +
        '<span class="badge' + (a.active === false ? " off" : "") + '">' +
        (a.active === false ? "Inactive" : "Active") + '</span></li>';
    }).join("");
  }

  function renderPortalSettings(s, branding) {
    var theme = normalizeTheme((branding && branding.theme_preset) || (s && s.theme) || "sanctuary");
    if ($("portalTheme")) $("portalTheme").value = theme;
    if ($("backgroundStyle")) $("backgroundStyle").value = (branding && branding.background_style) || "theme";
    if ($("backgroundUrl")) $("backgroundUrl").value = (branding && branding.background_image_url) || "";
    if ($("allowBackgroundGallery")) $("allowBackgroundGallery").value = s && s.allow_background_gallery !== false ? "1" : "0";
    if ($("scrapbookEnabled")) $("scrapbookEnabled").value = s && s.scrapbook_enabled !== false ? "1" : "0";
    if ($("scrapbookModeration")) $("scrapbookModeration").value = s && s.scrapbook_moderation ? "1" : "0";
    if ($("adultFilterEnabled")) $("adultFilterEnabled").value = s.adult_filter_enabled ? "1" : "0";
    if ($("adultFilterOverride")) $("adultFilterOverride").value = s.adult_filter_override ? "1" : "0";
    if ($("overrideWarningText")) $("overrideWarningText").value = s.override_warning_text || "";
  }

  function renderLinks(links) {
    var box = $("trustedSitesList");
    if (!box) return;
    if (!links.length) {
      box.innerHTML = '<p class="meta">No trusted sites yet — defaults seed on first portal load.</p>';
      return;
    }
    var byCat = {};
    links.forEach(function (l) {
      var cat = l.category || "space";
      if (!byCat[cat]) byCat[cat] = [];
      byCat[cat].push(l);
    });
    var html = "";
    TRUSTED_CATEGORIES.forEach(function (meta) {
      var catLinks = byCat[meta.id];
      if (!catLinks || !catLinks.length) return;
      html += '<div class="trusted-cat-group" data-cat="' + esc(meta.id) + '">' +
        '<h4 class="trusted-cat-head">' + esc(meta.icon) + ' ' + esc(meta.label) +
        ' <span class="trusted-cat-count">(' + catLinks.length + ')</span></h4>' +
        '<ul class="area-list trusted-cat-list">';
      catLinks.forEach(function (l) {
        html += '<li class="area-item" data-id="' + esc(l.id) + '">' +
          '<div><div class="name">' +
          (window.HavenSiteLogos ? HavenSiteLogos.adminLogoHtml(l) : esc(l.icon || "🔗")) +
          " " + esc(l.name) + '</div>' +
          '<div class="meta">' + esc(l.url) +
          (window.HavenSiteLogos ? ' · <span class="trusted-site-domain">' + esc(HavenSiteLogos.domainFromUrl(l.url)) + '</span>' : '') +
          '</div></div>' +
          '<div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">' +
          '<span class="badge' + (l.enabled ? "" : " off") + '">' + (l.enabled ? "Shown" : "Hidden") + '</span>' +
          '<button class="portal-btn" data-toggle="' + esc(l.id) + '" type="button">' +
          (l.enabled ? "Hide" : "Show") + '</button>' +
          (meta.id === "space" ? '<button class="portal-btn danger" data-del-link="' + esc(l.id) + '" type="button">Remove</button>' : '') +
          '</div></li>';
      });
      html += '</ul></div>';
    });
    box.innerHTML = html || '<p class="meta">No links in known categories.</p>';
    box.querySelectorAll("[data-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () { toggleLink(btn.getAttribute("data-toggle")); });
    });
    box.querySelectorAll("[data-del-link]").forEach(function (btn) {
      btn.addEventListener("click", function () { deleteLink(btn.getAttribute("data-del-link")); });
    });
  }

  function renderRequests(reqs) {
    var list = $("requestList");
    if (!list) return;
    var pending = reqs.filter(function (r) { return r.status === "pending"; });
    if (!pending.length) {
      list.innerHTML = '<li class="area-item"><span class="meta">No pending requests — all caught up!</span></li>';
      return;
    }
    list.innerHTML = pending.map(function (r) {
      return '<li class="area-item" data-req="' + esc(r.id) + '">' +
        '<div><div class="name">' + esc(r.name || r.url) + '</div>' +
        '<div class="meta">' + esc(r.url) + ' · from ' + esc(r.requested_by || "unknown") + '</div></div>' +
        '<div style="display:flex;gap:.5rem">' +
        '<button class="portal-btn primary" data-approve="' + esc(r.id) + '" type="button">Approve</button>' +
        '<button class="portal-btn danger" data-reject="' + esc(r.id) + '" type="button">Reject</button>' +
        '</div></li>';
    }).join("");
    list.querySelectorAll("[data-approve]").forEach(function (btn) {
      btn.addEventListener("click", function () { reviewRequest(btn.getAttribute("data-approve"), "approved"); });
    });
    list.querySelectorAll("[data-reject]").forEach(function (btn) {
      btn.addEventListener("click", function () { reviewRequest(btn.getAttribute("data-reject"), "rejected"); });
    });
  }

  function renderBranding(b) {
    if ($("logoUrl")) $("logoUrl").value = b.logo_url || "";
    if ($("heroUrl")) $("heroUrl").value = b.hero_image_url || "";
    if ($("backgroundUrl")) $("backgroundUrl").value = b.background_image_url || "";
    if ($("backgroundStyle")) $("backgroundStyle").value = b.background_style || "theme";
    if ($("portalTheme")) $("portalTheme").value = normalizeTheme(b.theme_preset || "sanctuary");
    if ($("primaryColor")) $("primaryColor").value = b.primary_color || "#c98a36";
    if ($("welcomeText")) $("welcomeText").value = b.welcome_text || "";
    var logoPrev = $("logoPreview");
    if (logoPrev) {
      if (b.logo_url) { logoPrev.src = b.logo_url; logoPrev.classList.remove("hidden"); }
      else logoPrev.classList.add("hidden");
    }
    if (root) root.style.setProperty("--pa-gold", b.primary_color || "#c98a36");
  }

  function renderAreas(areas) {
    var list = $("areaList");
    if (!list) return;
    if (!areas.length) {
      list.innerHTML = '<li class="area-item"><span class="meta">No trusted areas yet. Add your home, school, or other safe zones.</span></li>';
      return;
    }
    list.innerHTML = areas.map(function (a) {
      var loc = a.address || (a.lat != null ? a.lat + ", " + a.lng : "No coordinates");
      return '<li class="area-item" data-id="' + esc(a.id) + '">' +
        '<div><div class="name">' + esc(a.name) + '</div>' +
        '<div class="meta">' + esc(a.description || loc) + '</div></div>' +
        '<div style="display:flex;gap:.5rem;align-items:center">' +
        '<span class="badge' + (a.active === false ? " off" : "") + '">' + (a.active === false ? "Inactive" : "Active") + '</span>' +
        '<button class="portal-btn danger" data-del="' + esc(a.id) + '" type="button">Remove</button></div></li>';
    }).join("");
    list.querySelectorAll("[data-del]").forEach(function (btn) {
      btn.addEventListener("click", function () { deleteArea(btn.getAttribute("data-del")); });
    });
  }

  function renderMembers(members) {
    var box = $("memberList");
    if (!box) return;
    box.innerHTML = members.map(function (m) {
      return '<span class="member-chip">' + esc(m.email) + ' <em>(' + esc(m.role) + ')</em></span>';
    }).join("");
  }

  function savePortalSettings() {
    var status = $("portalSettingsStatus");
    var override = ($("adultFilterOverride") || {}).value === "1";
    var warning = (($("overrideWarningText") || {}).value || "").trim();
    if (override && !warning) {
      setStatus(status, "Warning text required when override is enabled.", false);
      return;
    }
    var theme = normalizeTheme(($("portalTheme") || {}).value || "sanctuary");
    var bgStyle = ($("backgroundStyle") || {}).value || "theme";
    var bgUrl = (($("backgroundUrl") || {}).value || "").trim();
    return auth.api("/" + state.slug + "/portal/settings", {
      method: "PATCH",
      body: {
        theme: theme,
        allow_background_gallery: ($("allowBackgroundGallery") || {}).value === "1",
        scrapbook_enabled: ($("scrapbookEnabled") || {}).value === "1",
        scrapbook_moderation: ($("scrapbookModeration") || {}).value === "1",
        adult_filter_enabled: ($("adultFilterEnabled") || {}).value === "1",
        adult_filter_override: override,
        override_warning_text: warning,
      },
    }).then(function () {
      return auth.api("/" + state.slug + "/branding", {
        method: "PATCH",
        body: { theme_preset: theme, background_style: bgStyle, background_image_url: bgUrl },
      });
    }).then(function () {
      setStatus(status, "Look & feel saved.", true);
      return loadPortal();
    }).catch(function (e) { setStatus(status, e.message, false); });
  }

  function saveBranding() {
    var status = $("brandStatus");
    return auth.api("/" + state.slug + "/branding", {
      method: "PATCH",
      body: {
        logo_url: ($("logoUrl") || {}).value || "",
        hero_image_url: ($("heroUrl") || {}).value || "",
        background_image_url: ($("backgroundUrl") || {}).value || "",
        background_style: ($("backgroundStyle") || {}).value || "theme",
        theme_preset: normalizeTheme(($("portalTheme") || {}).value || "soft-ocean"),
        primary_color: ($("primaryColor") || {}).value || "#c98a36",
        welcome_text: ($("welcomeText") || {}).value || "",
      },
    }).then(function () {
      setStatus(status, "Branding saved.", true);
      return loadPortal();
    }).catch(function (e) { setStatus(status, e.message, false); });
  }

  function addLink() {
    var status = $("linkStatus");
    var name = (($("linkName") || {}).value || "").trim();
    var url = (($("linkUrl") || {}).value || "").trim();
    if (!name || !url) { setStatus(status, "Name and URL required.", false); return; }
    auth.api("/" + state.slug + "/portal/links", {
      method: "POST",
      body: {
        category: ($("linkCategory") || {}).value || "space",
        name: name, url: url,
        icon: ($("linkIcon") || {}).value || "",
        logo_url: window.HavenSiteLogos ? HavenSiteLogos.logoUrlForLink({ url: url }, { fromOps: true }) : "",
        enabled: true,
      },
    }).then(function () {
      setStatus(status, "Link added.", true);
      if ($("linkName")) $("linkName").value = "";
      if ($("linkUrl")) $("linkUrl").value = "";
      if ($("linkIcon")) $("linkIcon").value = "";
      return loadPortalAdmin();
    }).catch(function (e) { setStatus(status, e.message, false); });
  }

  function toggleLink(id) {
    auth.api("/" + state.slug + "/portal/home").then(function (data) {
      var link = (data.portal.all_links || []).find(function (l) { return l.id === id; });
      if (!link) throw new Error("link_not_found");
      return auth.api("/" + state.slug + "/portal/links/" + id, {
        method: "PATCH", body: { enabled: !link.enabled },
      });
    }).then(loadPortalAdmin).catch(function (e) { alert(e.message); });
  }

  function deleteLink(id) {
    auth.api("/" + state.slug + "/portal/links/" + id, { method: "DELETE" })
      .then(loadPortalAdmin).catch(function (e) { alert(e.message); });
  }

  function reviewRequest(id, st) {
    var status = $("requestStatus");
    auth.api("/" + state.slug + "/portal/requests/" + id, {
      method: "PATCH",
      body: { status: st, add_to_spaces: st === "approved" },
    }).then(function () {
      setStatus(status, st === "approved" ? "Approved — added to My Spaces." : "Request rejected.", true);
      return loadPortalAdmin();
    }).catch(function (e) {
      var msg = e.message || "Could not update request";
      if (msg === "license_required" || msg === "invalid_license") {
        msg = "Session expired — sign out and sign in again with your Haven license key.";
      } else if (msg === "request_not_found") {
        msg = "Request not found — refresh the page and try again.";
      } else if (msg === "admin_required" || msg === "forbidden") {
        msg = "Admin access required — sign in with your license key and owner email.";
      }
      setStatus(status, msg, false);
    });
  }

  function addArea() {
    var status = $("areaStatus");
    var name = (($("areaName") || {}).value || "").trim();
    if (!name) { setStatus(status, "Name required.", false); return; }
    auth.api("/" + state.slug + "/trusted-areas", {
      method: "POST",
      body: {
        name: name,
        description: ($("areaDesc") || {}).value || "",
        address: ($("areaAddress") || {}).value || "",
        lat: parseFloat(($("areaLat") || {}).value) || null,
        lng: parseFloat(($("areaLng") || {}).value) || null,
        radius_m: parseFloat(($("areaRadius") || {}).value) || null,
        active: true,
      },
    }).then(function () {
      setStatus(status, "Trusted area added.", true);
      if ($("areaName")) $("areaName").value = "";
      if ($("areaDesc")) $("areaDesc").value = "";
      if ($("areaAddress")) $("areaAddress").value = "";
      return loadPortal();
    }).catch(function (e) { setStatus(status, e.message, false); });
  }

  function deleteArea(id) {
    auth.api("/" + state.slug + "/trusted-areas/" + id, { method: "DELETE" })
      .then(loadPortal).catch(function (e) { alert(e.message); });
  }

  function inviteMember() {
    var status = $("memberStatus");
    var email = (($("memberEmail") || {}).value || "").trim().toLowerCase();
    var role = ($("memberRole") || {}).value || "user";
    if (!email) { setStatus(status, "Email required.", false); return; }
    auth.api("/" + state.slug + "/members", {
      method: "POST", body: { email: email, role: role },
    }).then(function (res) {
      var msg = "Member invited.";
      if (res.login_url) msg += " Share this link: " + res.login_url;
      setStatus(status, msg, true);
      if ($("memberEmail")) $("memberEmail").value = "";
      return loadPortal();
    }).catch(function (e) { setStatus(status, e.message, false); });
  }

  function scrollToSection() {
    if (window.location.hash === "#portalAdmin" && root) {
      setTimeout(function () { root.scrollIntoView({ behavior: "smooth", block: "start" }); }, 300);
    }
  }

  function init() {
    bindAdminAuthForm();
    ensureSession();
    scrollToSection();
    window.addEventListener("hashchange", scrollToSection);

    if ($("saveBrandBtn")) $("saveBrandBtn").addEventListener("click", saveBranding);
    if ($("addAreaBtn")) $("addAreaBtn").addEventListener("click", addArea);
    if ($("inviteBtn")) $("inviteBtn").addEventListener("click", inviteMember);
    if ($("savePortalSettingsBtn")) $("savePortalSettingsBtn").addEventListener("click", savePortalSettings);
    if ($("addLinkBtn")) $("addLinkBtn").addEventListener("click", addLink);
    if ($("portalAdminSignOutBtn")) {
      $("portalAdminSignOutBtn").addEventListener("click", function () {
        auth.signOut().then(function () {
          showGate();
          var so = $("portalAdminSignOutBtn");
          if (so) so.classList.add("hidden");
        });
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
