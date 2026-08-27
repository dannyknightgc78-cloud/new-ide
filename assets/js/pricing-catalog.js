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
 * Canonical Haven plan prices + honest annual discount math (monthly × 12 vs annual).
 */
(function () {
  "use strict";

  var CATALOG = {
    solo: {
      name: "Single Child / Device",
      taglineMonthly: "One device — vault, filters, Portal Admin cloud.",
      taglineAnnual: "One device — pay yearly, save vs monthly.",
      monthly: { euros: 4.99, cents: 499, suffix: "/month", planId: "solo" },
      annual: { euros: 49.99, cents: 4999, suffix: "/year", planId: "solo_annual" }
    },
    family: {
      name: "Family Haven",
      taglineMonthly: "Whole household — one dashboard, billed monthly.",
      monthly: { euros: 9.99, cents: 999, suffix: "/month", planId: "family" }
    },
    sovereign: {
      name: "Sovereign Gold",
      tagline: "Self-host Haven — generational sovereignty.",
      annual: { euros: 49.99, cents: 4999, suffix: "/year", planId: "sovereign" }
    }
  };

  function fmt(euros) {
    return "€" + Number(euros).toFixed(2);
  }

  function yearlyFromMonthly(monthlyEuros) {
    return Math.round(monthlyEuros * 12 * 100) / 100;
  }

  function discountPct(monthlyEuros, annualEuros) {
    var full = monthlyEuros * 12;
    if (full <= 0) return 0;
    return Math.round((1 - annualEuros / full) * 100);
  }

  function monthsFree(monthlyEuros, annualEuros) {
    var saved = monthlyEuros * 12 - annualEuros;
    if (monthlyEuros <= 0) return 0;
    return Math.max(0, Math.round(saved / monthlyEuros));
  }

  function monthlyEquivalent(annualEuros) {
    return Math.round((annualEuros / 12) * 100) / 100;
  }

  function resolvePlanId(tier, billing) {
    var key = (tier || "").toLowerCase();
    if (key === "sovereign") return "sovereign";
    var entry = CATALOG[key];
    if (!entry) return key;
    var cycle = billing === "annual" ? "annual" : "monthly";
    return (entry[cycle] && entry[cycle].planId) || key;
  }

  function quote(tier, billing) {
    var key = (tier || "").toLowerCase();
    var entry = CATALOG[key];
    if (!entry) return null;
    if (key === "sovereign") {
      var a = entry.annual;
      return {
        tier: key,
        billing: "annual",
        planId: a.planId,
        price: fmt(a.euros),
        amount: fmt(a.euros),
        suffix: a.suffix,
        compareAt: null,
        discountPct: null,
        monthsFree: null,
        monthlyEq: fmt(monthlyEquivalent(a.euros))
      };
    }
    var cycle = billing === "annual" ? "annual" : "monthly";
    var opt = entry[cycle];
    if (!opt) return null;
    var fullYear = yearlyFromMonthly(entry.monthly.euros);
    var pct = cycle === "annual" ? discountPct(entry.monthly.euros, opt.euros) : null;
    var free = cycle === "annual" ? monthsFree(entry.monthly.euros, opt.euros) : null;
    return {
      tier: key,
      billing: cycle,
      planId: opt.planId,
      price: fmt(opt.euros),
      amount: fmt(opt.euros),
      suffix: opt.suffix,
      compareAt: cycle === "annual" ? fmt(fullYear) : null,
      discountPct: pct,
      monthsFree: free,
      monthlyEq: cycle === "annual" ? fmt(monthlyEquivalent(opt.euros)) : null
    };
  }

  window.HavenPricingCatalog = {
    catalog: CATALOG,
    fmt: fmt,
    yearlyFromMonthly: yearlyFromMonthly,
    discountPct: discountPct,
    monthsFree: monthsFree,
    monthlyEquivalent: monthlyEquivalent,
    resolvePlanId: resolvePlanId,
    quote: quote
  };
})();
