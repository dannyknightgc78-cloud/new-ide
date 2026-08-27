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
 * Copyright (c) 2026 Haven — your digital sanctuary. All rights reserved.
 *
 * Monthly / Annual billing toggle for pricing cards (index + pricing pages).
 */
(function () {
  "use strict";

  var CAT = window.HavenPricingCatalog;
  var STORAGE_KEY = "haven.billingCycle";
  var state = { billing: "monthly" };

  function readBilling() {
    try {
      var q = new URLSearchParams(location.search).get("billing");
      if (q === "monthly" || q === "annual") return q;
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "monthly" || stored === "annual") return stored;
    } catch (e) { /* ignore */ }
    return "monthly";
  }

  function persistBilling() {
    try { localStorage.setItem(STORAGE_KEY, state.billing); } catch (e) { /* ignore */ }
    try {
      var u = new URL(location.href);
      u.searchParams.set("billing", state.billing);
      history.replaceState(null, "", u.pathname + u.search + u.hash);
    } catch (e) { /* ignore */ }
  }

  function setToggleUi() {
    document.querySelectorAll(".billing-toggle-btn").forEach(function (btn) {
      var on = btn.getAttribute("data-billing") === state.billing;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    var badge = document.querySelector(".billing-save-badge");
    if (badge && CAT) {
      var pct = CAT.discountPct(4.99, 49.99);
      badge.textContent = "Save " + pct + "%";
    }
  }

  function updateCard(card) {
    if (!CAT) return;
    var tier = (card.getAttribute("data-plan-card") || "").toLowerCase();
    if (!tier || tier === "free" || tier === "school") return;

    var q = CAT.quote(tier, state.billing);
    if (!q && state.billing === "annual") {
      q = CAT.quote(tier, "monthly");
    }
    if (!q) return;

    var amountEl = card.querySelector("[data-price-amount]");
    var suffixEl = card.querySelector("[data-price-suffix]");
    var compareEl = card.querySelector("[data-price-compare]");
    var saveEl = card.querySelector("[data-price-save]");
    var taglineEl = card.querySelector("[data-price-tagline]");
    var btn = card.querySelector("[data-haven-checkout]");
    var btnLabel = card.querySelector(".btn-label");

    if (amountEl) amountEl.textContent = q.price;
    if (suffixEl) suffixEl.textContent = q.suffix;
    if (compareEl) {
      compareEl.textContent = q.compareAt ? q.compareAt + "/yr" : "";
      compareEl.hidden = !q.compareAt;
    }
    if (saveEl) {
      if (q.discountPct) {
        saveEl.textContent = "Save " + q.discountPct + "%";
        saveEl.hidden = false;
      } else if (tier === "sovereign" && q.monthlyEq) {
        saveEl.textContent = q.monthlyEq + "/mo";
        saveEl.hidden = false;
      } else {
        saveEl.hidden = true;
      }
    }
    if (taglineEl) {
      var entry = CAT.catalog[tier];
      if (tier === "sovereign") {
        /* Monthly equivalent lives in .price-save-badge — keep tagline short for narrow cards */
        taglineEl.textContent = entry.tagline;
      } else if (state.billing === "annual" && q.monthsFree >= 2) {
        taglineEl.textContent = (entry.taglineAnnual || entry.taglineMonthly)
          + " · " + q.monthsFree + " months free vs monthly.";
      } else if (state.billing === "annual") {
        taglineEl.textContent = entry.taglineAnnual || entry.taglineMonthly;
      } else {
        taglineEl.textContent = entry.taglineMonthly;
      }
    }
    if (btn) {
      btn.setAttribute("data-plan", q.planId);
      btn.setAttribute("data-billing", state.billing);
      var checkoutUrl = "checkout.html?plan=" + encodeURIComponent(q.planId);
      if (state.billing === "monthly" || state.billing === "annual") {
        checkoutUrl += "&billing=" + encodeURIComponent(state.billing);
      }
      btn.setAttribute("href", checkoutUrl);
    }
    if (btnLabel) {
      btnLabel.textContent = "Get " + (tier === "solo" ? "Solo" : tier === "family" ? "Family" : "Sovereign")
        + " — " + q.price + q.suffix.replace("/", "/");
    }
  }

  function render() {
    setToggleUi();
    document.querySelectorAll("[data-plan-card]").forEach(updateCard);
    document.querySelectorAll("[data-billing-price]").forEach(function (cell) {
      var tier = (cell.getAttribute("data-billing-price") || "").toLowerCase();
      var q = CAT && CAT.quote(tier, state.billing);
      if (q) cell.textContent = q.price + q.suffix;
    });
  }

  function setBilling(next) {
    if (next !== "monthly" && next !== "annual") return;
    state.billing = next;
    persistBilling();
    render();
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!CAT) return;
    state.billing = readBilling();
    document.querySelectorAll(".billing-toggle-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setBilling(btn.getAttribute("data-billing"));
      });
    });
    render();
  });

  window.HavenPricingBilling = { getBilling: function () { return state.billing; }, setBilling: setBilling };
})();
