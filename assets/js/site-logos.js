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
 * Haven — trusted site logo resolver (domain → favicon / cached PNG).
 * Used by portal hub and Admin Ops trusted-sites list.
 */
(function (global) {
  "use strict";

  var PORTAL_ICONS = "assets/icons/";
  var OPS_ICONS = "portal/assets/icons/";

  /** domain → cached filename under portal/assets/icons/ */
  var LOCAL = {
    "mail.google.com": "gmail.png",
    "gmail.com": "gmail.png",
    "google.com": "google.png",
    "docs.google.com": "google-docs.png",
    "drive.google.com": "google-drive.png",
    "maps.google.com": "google-maps.png",
    "youtube.com": "youtube.png",
    "www.youtube.com": "youtube.png",
    "open.spotify.com": "spotify.png",
    "spotify.com": "spotify.png",
    "bsky.app": "bluesky.png",
    "mastodon.social": "mastodon.png",
    "linkedin.com": "linkedin.png",
    "www.linkedin.com": "linkedin.png",
    "outlook.live.com": "outlook.png",
    "outlook.com": "outlook.png",
    "khanacademy.org": "khan-academy.png",
    "www.khanacademy.org": "khan-academy.png",
    "duolingo.com": "duolingo.png",
    "www.duolingo.com": "duolingo.png",
    "notion.so": "notion.png",
    "www.notion.so": "notion.png",
    "expedia.com": "expedia.png",
    "www.expedia.com": "expedia.png",
    "bbc.co.uk": "bbc.png",
    "www.bbc.co.uk": "bbc.png",
    "bbc.com": "bbc.png",
    "bitesize.bbc.co.uk": "bbc-bitesize.png",
    "facebook.com": "facebook.png",
    "www.facebook.com": "facebook.png",
    "vimeo.com": "vimeo.png",
    "coursera.org": "coursera.png",
    "grammarly.com": "grammarly.png",
    "wikipedia.org": "wikipedia.png",
    "dropbox.com": "dropbox.png",
    "onedrive.live.com": "onedrive.png",
    "trello.com": "trello.png",
    "canva.com": "canva.png",
    "figma.com": "figma.png",
    "proton.me": "proton.png",
  };

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function domainFromUrl(url) {
    if (!url || url.indexOf("#") === 0) return "";
    try {
      var host = new URL(url).hostname.toLowerCase();
      if (host.indexOf("www.") === 0) host = host.slice(4);
      return host;
    } catch (e) {
      var m = String(url).match(/^(?:https?:\/\/)?(?:www\.)?([^/?#]+)/i);
      return m ? m[1].toLowerCase() : "";
    }
  }

  function faviconUrl(domain, size) {
    if (!domain) return "";
    return "https://www.google.com/s2/favicons?domain=" +
      encodeURIComponent(domain) + "&sz=" + (size || 128);
  }

  function localFile(domain) {
    if (!domain) return "";
    if (LOCAL[domain]) return LOCAL[domain];
    var parts = domain.split(".");
    if (parts.length > 2) {
      var parent = parts.slice(-2).join(".");
      if (LOCAL[parent]) return LOCAL[parent];
    }
    return "";
  }

  function iconsBase(fromOps) {
    return fromOps ? OPS_ICONS : PORTAL_ICONS;
  }

  function logoUrlForLink(link, opts) {
    opts = opts || {};
    if (!link) return "";
    if (link.logo_url) return link.logo_url;
    var domain = domainFromUrl(link.url);
    if (!domain) return "";
    var file = localFile(domain);
    if (file) return iconsBase(opts.fromOps) + file;
    return faviconUrl(domain, opts.size || 128);
  }

  function logoImgHtml(link, opts) {
    opts = opts || {};
    if (!link || !link.url || link.url.indexOf("#") === 0) {
      var glyph = esc(link && link.icon ? link.icon : "🔗");
      return '<span class="mh-orbit-glyph mh-site-logo-fallback" aria-hidden="true">' + glyph + "</span>";
    }
    var domain = domainFromUrl(link.url);
    var src = logoUrlForLink(link, opts);
    var fallback = faviconUrl(domain, 128);
    var cls = "mh-site-logo" + (opts.className ? " " + opts.className : "");
    var display = opts.displaySize || 64;
    return '<img class="' + cls + '" src="' + esc(src) + '" alt="" width="' + display + '" height="' + display +
      '" loading="lazy" decoding="async"' +
      ' data-domain="' + esc(domain) + '"' +
      ' onerror="this.onerror=null;this.src=\'' + esc(fallback) + '\';"' +
      "/>";
  }

  function adminLogoHtml(link) {
    var src = logoUrlForLink(link, { fromOps: true, size: 64 });
    var domain = domainFromUrl(link.url);
    var fallback = faviconUrl(domain, 32);
    return '<img class="trusted-site-logo" src="' + esc(src) + '" alt="" width="28" height="28" loading="lazy"' +
      ' onerror="this.onerror=null;this.src=\'' + esc(fallback) + '\';"' +
      "/>";
  }

  global.HavenSiteLogos = {
    domainFromUrl: domainFromUrl,
    faviconUrl: faviconUrl,
    logoUrlForLink: logoUrlForLink,
    logoImgHtml: logoImgHtml,
    adminLogoHtml: adminLogoHtml,
    localFile: localFile,
  };
})(typeof window !== "undefined" ? window : this);
