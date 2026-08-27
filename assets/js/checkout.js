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
   Haven — Stripe Checkout (hosted) kickoff, tier/version aware.

   Each plan CTA (data-haven-checkout with a data-plan of "solo" | "family" |
   "sovereign") redirects to Stripe Payment Links or creates a hosted Checkout
   Session (live API mode).

   Backend: POST {apiBase}/api/haven/payments/create-checkout-session {plan} -> { url }
            GET  {apiBase}/api/haven/payments/config -> { enabled, plans, payment_links }
   apiBase is resolved by config.js (window.HAVEN_CONFIG).
   ============================================================ */
(function () {
  "use strict";

  var CFG = window.HAVEN_CONFIG || {};
  var API = String(CFG.apiBase || "").replace(/\/+$/, "");
  var EP = API + "/api/haven/payments";
  var LAST_PLAN_KEY = "haven.lastPlan";
  var HAVEN_SITE = (location.hostname || "").toLowerCase() === "haven.dannygc.cloud";
  var CHECKOUT_URL = "https://haven.dannygc.cloud/pricing.html";
  var checkoutCfg = {
    use_payment_links: false,
    payment_links: {},
    payment_links_live: false,
    stripe_mode: "",
    enabled: true
  };
  var configPromise = null;

  function onHavenSite() {
    return HAVEN_SITE;
  }

  function $buttons() {
    return Array.prototype.slice.call(document.querySelectorAll("[data-haven-checkout]"));
  }

  function planOf(btn) {
    return (btn.getAttribute("data-plan") || "").trim().toLowerCase();
  }

  function setError(msg) {
    var el = document.getElementById("checkoutError");
    if (el) el.textContent = msg || "";
  }

  function paymentLinkForPlan(plan) {
    return plan && checkoutCfg.payment_links[plan];
  }

  function paymentLinkIsTest(url) {
    return String(url || "").toLowerCase().indexOf("/test/") !== -1;
  }

  function paymentLinksAreLive() {
    if (checkoutCfg.payment_links_live) return true;
    var links = checkoutCfg.payment_links || {};
    var keys = Object.keys(links);
    if (!keys.length) return false;
    return keys.every(function (k) { return !paymentLinkIsTest(links[k]); });
  }

  function showTestCheckoutHints() {
    return checkoutCfg.stripe_mode === "test" && !paymentLinksAreLive();
  }

  function showCheckoutBanner() {
    var banner = document.getElementById("paymentsBanner");
    var label = document.getElementById("paymentsBannerLabel");
    var hint = document.getElementById("paymentsBannerHint");
    if (!banner) return;
    banner.hidden = false;
    banner.classList.remove("beta-banner-hot");
    if (label) label.textContent = "Secure checkout";
    if (hint) {
      if (showTestCheckoutHints()) {
        hint.innerHTML = "Payments via <b>Stripe</b> (test card <code>4242 4242 4242 4242</code>)"
          + " · any future expiry · any CVC";
      } else {
        hint.innerHTML = "Payments via <b>Stripe</b> — cards, <b>Klarna</b>, <b>Apple&nbsp;Pay</b> &amp; <b>Google&nbsp;Pay</b>"
          + " · subscriptions auto-renew until cancelled";
      }
    }
    var testHint = document.getElementById("betaTestHint");
    if (testHint) testHint.hidden = !showTestCheckoutHints();
  }

  function loadConfig() {
    if (!configPromise) {
      configPromise = fetch(EP + "/config", { method: "GET" })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          d = d || {};
          checkoutCfg.use_payment_links = !!d.use_payment_links;
          checkoutCfg.payment_links = d.payment_links || {};
          checkoutCfg.payment_links_live = !!d.payment_links_live;
          checkoutCfg.stripe_mode = String(d.stripe_mode || "").toLowerCase();
          checkoutCfg.enabled = d.enabled !== false;
          return d;
        });
    }
    return configPromise;
  }

  function applyConfig(d) {
    d = d || {};
    var plans = d.plans || {};
    $buttons().forEach(function (b) {
      var plan = planOf(b);
      var linkOk = !!paymentLinkForPlan(plan);
      var apiOk = !checkoutCfg.use_payment_links && plan && (plan in plans) ? !!plans[plan] : true;
      var ok = checkoutCfg.enabled && (linkOk || apiOk);
      b.setAttribute("data-checkout-ready", ok ? "1" : "0");
    });
    showCheckoutBanner();
    /* Pricing CTAs route to checkout.html — that page probes /config and surfaces errors. */
  }

  function probeConfig() {
    loadConfig()
      .then(applyConfig)
      .catch(function () { /* leave buttons clickable; click handles errors */ });
  }

  function startCheckout(btn) {
    setError("");
    var plan = planOf(btn) || "family";
    var billing = (btn.getAttribute("data-billing") || "").trim().toLowerCase();
    if (!billing && window.HavenPricingBilling && HavenPricingBilling.getBilling) {
      billing = HavenPricingBilling.getBilling();
    }
    if (window.HavenAnalytics && HavenAnalytics.track) {
      HavenAnalytics.track("click", "checkout_" + plan, { plan: plan, metadata: { plan: plan, billing: billing } });
    }
    try { localStorage.setItem(LAST_PLAN_KEY, plan); } catch (e) { /* ignore */ }
    var url = "checkout.html?plan=" + encodeURIComponent(plan);
    if (billing === "monthly" || billing === "annual") {
      url += "&billing=" + encodeURIComponent(billing);
    }
    window.location.href = url;
  }

  document.addEventListener("DOMContentLoaded", function () {
    var btns = $buttons();
    if (!btns.length) return;

    if (!onHavenSite()) {
      btns.forEach(function (b) {
        b.addEventListener("click", function (e) {
          e.preventDefault();
          window.location.href = CHECKOUT_URL;
        });
      });
      return;
    }

    probeConfig();
    btns.forEach(function (b) {
      b.addEventListener("click", function (e) {
        var plan = planOf(b) || "family";
        var billing = (b.getAttribute("data-billing") || "").trim().toLowerCase();
        if (!billing && window.HavenPricingBilling && HavenPricingBilling.getBilling) {
          billing = HavenPricingBilling.getBilling();
        }
        if (window.HavenAnalytics && HavenAnalytics.track) {
          HavenAnalytics.track("click", "checkout_" + plan, { plan: plan, metadata: { plan: plan, billing: billing } });
        }
        try { localStorage.setItem(LAST_PLAN_KEY, plan); } catch (err) { /* ignore */ }
        if (b.tagName === "A" && b.getAttribute("href")) return;
        e.preventDefault();
        startCheckout(b);
      });
    });
  });
})();
