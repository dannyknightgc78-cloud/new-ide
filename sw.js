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

/* Haven service worker — intentionally minimal and update-safe.
 *
 * Design goals:
 *  - Make the app installable (PWA) on Android/desktop Chrome/Edge.
 *  - NEVER serve stale HTML/JS: navigations + same-origin assets are
 *    network-first, so a normal deploy is picked up immediately.
 *  - Provide only a tiny offline fallback so an offline launch is calm,
 *    not a browser error.
 *  - Never touch the Haven API (ghostgrid.dannygc.cloud) — those requests
 *    pass straight through to the network, untouched.
 */
"use strict";

const CACHE_NAME = "haven-cache-2026-07-10-v5";
const OFFLINE_URL = "./offline.html";
const PRECACHE = [OFFLINE_URL, "./manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle same-origin GETs. The Haven API and fonts are cross-origin
  // and are deliberately left untouched (default browser behaviour).
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first, fall back to the offline shell when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Same-origin static assets: network-first, cache as a warm fallback only.
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req))
  );
});
