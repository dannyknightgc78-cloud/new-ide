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
   Haven — Portal Admin (LIVE)
   Every panel is driven by the REAL sidecar: device state, Chain of
   Trust, anomalies, signed commands and the kill-switch all hit
   /api/haven/* and render real responses. No mock data; honest
   empty/offline states.
   ============================================================ */
(function () {
  "use strict";
  var H = window.Haven;
  var $ = function (id) { return document.getElementById(id); };

  var els = {
    banner: $("mockBanner") || $("liveBanner"),
    deviceBar: $("deviceBar"),
    statusBanner: $("statusBanner"),
    metrics: $("metrics"),
    chain: $("chain"),
    chainHead: $("chainHead"),
    chainCount: $("chainCount"),
    driftBody: $("driftBody"),
    simDrift: $("simDrift"),
    cmdSelect: $("cmdSelect"),
    cmdSend: $("cmdSend"),
    quickCmds: $("quickCmds"),
    cmdToast: $("cmdToast"),
    killChild: $("killChild"),
    killState: $("killState"),
    holdBtn: $("holdBtn"),
    holdFill: $("holdFill"),
    holdLabel: $("holdLabel"),
    holdHint: $("holdHint"),
    unlockBtn: $("unlockBtn"),
    killToast: $("killToast"),
    modal: $("blockModal"),
    modalLabel: $("modalLabel"),
    modalKv: $("modalKv"),
    modalClose: $("modalClose"),
    modeToggle: $("modeToggle")
  };

  var state = { devices: [], selected: null, integrity: null, privacy: "proof-only" };
  try { state.selected = localStorage.getItem("haven.selDevice"); } catch (e) {}

  function selDevice() {
    return state.devices.filter(function (d) { return d.id === state.selected; })[0] || state.devices[0] || null;
  }

  /* ---- connection banner ---------------------------------- */
  function setBanner(mode, text) {
    if (!els.banner) return;
    els.banner.classList.remove("hidden");
    var color = mode === "ok" ? "var(--verified-soft)" : mode === "off" ? "var(--locked-soft)" : "var(--gold-soft)";
    var ink = mode === "ok" ? "var(--haven-deep)" : mode === "off" ? "var(--locked)" : "#8a5e1c";
    els.banner.style.background = color; els.banner.style.color = ink;
    els.banner.style.borderColor = "transparent";
    els.banner.innerHTML = '<span aria-hidden="true">●</span><span>' + H.esc(text) + "</span>";
  }

  /* ---- device bar ----------------------------------------- */
  function renderDevices() {
    if (!els.deviceBar) return;
    if (!state.devices.length) {
      els.deviceBar.innerHTML = '<div class="card" style="width:100%"><strong>No devices enrolled yet.</strong>' +
        '<p class="muted mt-1" style="font-size:.9rem">Enroll a My Portal device by registering it with the sidecar ' +
        '(<span class="mono">POST /api/haven/device/register</span>). Live device state will appear here.</p></div>';
      return;
    }
    els.deviceBar.innerHTML = "";
    state.devices.forEach(function (d) {
      var b = document.createElement("button");
      b.className = "device-chip" + (d.id === (selDevice() || {}).id ? " active" : "");
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", d.id === (selDevice() || {}).id ? "true" : "false");
      b.innerHTML = '<span class="dc-emoji">' + H.esc(d.emoji || "🛡️") + '</span>' +
        '<span><span class="dc-name">' + H.esc(d.child) + '</span><br>' +
        '<span class="dc-meta">' + H.esc(d.device) + '</span></span>' +
        '<span class="dc-lock">' + (d.locked
          ? '<span class="pill pill-locked" style="padding:.15rem .5rem">Locked</span>'
          : '<span class="pill pill-green" style="padding:.15rem .5rem">Online</span>') + '</span>';
      b.addEventListener("click", function () {
        state.selected = d.id; try { localStorage.setItem("haven.selDevice", d.id); } catch (e) {}
        renderAll();
      });
      els.deviceBar.appendChild(b);
    });
  }

  /* ---- status banner -------------------------------------- */
  function renderStatus() {
    if (!els.statusBanner) return;
    var d = selDevice();
    var drift = state.integrity && state.integrity.system_drift;
    if (!d) { els.statusBanner.classList.add("hidden"); return; }
    els.statusBanner.classList.remove("hidden");
    var locked = d.locked;
    els.statusBanner.classList.toggle("locked", locked || drift);
    var icon = locked
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/><path d="m9 12 2 2 4-4"/></svg>';
    var title = locked ? d.child + "'s internet is locked"
      : drift ? "Integrity attention needed on " + d.child + "'s device"
        : d.child + "'s device is protected & verified";
    var sub = locked ? "Issued as a signed command and notarized. My Portal shows a calm offline screen."
      : drift ? "A System-Drift anomaly was detected — see the feed below."
        : "Chain verified · " + (state.privacy === "proof-only" ? "proof-only privacy" : state.privacy) + " · head " + H.shortHash((state.integrity || {}).head_hash, 10);
    els.statusBanner.innerHTML =
      '<span class="sb-icon">' + icon + '</span>' +
      '<div><div class="sb-title">' + H.esc(title) + '</div><div class="sb-sub">' + H.esc(sub) + '</div></div>' +
      '<span class="sb-action">' + (state.privacy === "proof-only"
        ? '<span class="pill pill-sky">🔒 Proof-only</span>' : '') + '</span>';
  }

  /* ---- metric cards (real, sourced from the live ledger) -- */
  function renderMetrics(chain) {
    if (!els.metrics) return;
    var blocks = (chain && chain.blocks) || [];
    var proofs = blocks.filter(function (b) { return ["action", "rule", "enrollment"].indexOf(b.kind) >= 0; }).length;
    var commands = blocks.filter(function (b) { return b.kind === "command"; }).length;
    var total = (chain && chain.total) || 0;
    var status = (chain && chain.verify && chain.verify.status) || "—";
    function card(cls, icon, value, label, sub) {
      return '<div class="card metric ' + cls + '"><div class="m-top"><div class="m-icon">' + icon +
        '</div><span class="pill ' + (cls === "green" ? "pill-green" : cls === "sky" ? "pill-sky" : "pill-gold") +
        '">live</span></div><div class="m-value">' + value + '</div><div class="m-label">' + label +
        '</div><div class="muted" style="font-size:.78rem;margin-top:.4rem">' + sub + '</div></div>';
    }
    els.metrics.innerHTML =
      card("green", '<svg viewBox="0 0 24 24"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/><path d="m9 12 2 2 4-4"/></svg>',
        proofs, "Verified Safety Checks", "recent notarized integrity proofs") +
      card("sky", '<svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
        commands, "Signed Admin Commands", "in the current window") +
      card("gold", '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
        total.toLocaleString(), "System Integrity Reports", "chain verify: " + status);
  }

  /* ---- chain of trust ------------------------------------- */
  function blockEl(b) {
    var el = document.createElement("div");
    var cls = (b.kind === "system_drift" || b.kind === "drift" || b.kind === "command_rejected") ? " block-drift"
      : (b.kind === "command" && (b.meta || {}).cmd === "internet_lock") ? " block-lock"
        : (b.kind === "command") ? " block-command" : "";
    el.className = "block" + cls;
    el.setAttribute("tabindex", "0"); el.setAttribute("role", "button");
    var anomaly = (b.kind === "system_drift" || b.kind === "drift" || b.kind === "command_rejected");
    var pill = anomaly ? '<span class="pill pill-alert" style="padding:.15rem .5rem;font-size:.7rem">Anomaly</span>'
      : '<span class="pill pill-green" style="padding:.15rem .5rem;font-size:.7rem"><span class="dot"></span> Verified</span>';
    var icon = anomaly ? '<span class="pill pill-alert" style="padding:.18rem .5rem">!</span>'
      : '<span class="check">' + H.checkSvg + '</span>';
    el.innerHTML = '<div class="block-icon">' + icon + '</div><div class="block-body">' +
      '<div class="row-between"><span class="block-label">' + H.esc(b.label) + '</span><span class="block-seq">#' + H.esc(b.seq) + '</span></div>' +
      '<div class="block-meta">' + pill + '<span class="block-hash">hash ' + H.esc(H.shortHash(b.entry_hash)) +
      '</span><span class="block-hash">' + H.esc(H.clockTime(b.ts)) + '</span></div></div>';
    el.addEventListener("click", function () { openModal(b); });
    el.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openModal(b); } });
    return el;
  }
  function renderChain(chain) {
    if (!els.chain) return;
    var blocks = (chain && chain.blocks) || [];
    if (!blocks.length) {
      els.chain.innerHTML = '<p class="muted" style="text-align:center;padding:2rem">No ledger entries yet. ' +
        'Proofs will appear as the shield reports.</p>';
    } else {
      els.chain.innerHTML = ""; blocks.forEach(function (b) { els.chain.appendChild(blockEl(b)); });
    }
    if (els.chainHead) els.chainHead.textContent = H.shortHash((chain || {}).head_hash, 14);
    if (els.chainCount) els.chainCount.textContent = ((chain || {}).total || 0).toLocaleString();
  }

  /* ---- modal ---------------------------------------------- */
  function openModal(b) {
    if (!els.modal) return;
    els.modalLabel.textContent = b.label;
    var rows = [
      ["seq", "#" + b.seq], ["kind", b.kind], ["timestamp", b.ts],
      ["entry hash", b.entry_hash], ["prev hash", b.prev_hash],
      ["algorithm", b.algorithm || "Ed25519"], ["key fp", b.key_fingerprint || ""],
      ["signature", b.signature || ""]
    ];
    if ((b.meta || {}).cmd) rows.push(["command", b.meta.cmd]);
    if ((b.meta || {}).reasons) rows.push(["reasons", (b.meta.reasons || []).join(", ")]);
    if ((b.meta || {}).proof_only != null) rows.push(["proof-only", String(b.meta.proof_only)]);
    els.modalKv.innerHTML = rows.map(function (r) {
      return "<dt>" + H.esc(r[0]) + "</dt><dd>" + H.esc(r[1]) + "</dd>";
    }).join("");
    els.modal.classList.add("show");
  }
  function closeModal() { if (els.modal) els.modal.classList.remove("show"); }
  if (els.modalClose) els.modalClose.addEventListener("click", closeModal);
  if (els.modal) els.modal.addEventListener("click", function (e) { if (e.target === els.modal) closeModal(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });

  /* ---- anomalies feed ------------------------------------- */
  function renderAnomalies(anoms) {
    if (!els.driftBody) return;
    var list = (anoms && anoms.anomalies) || [];
    if (!list.length) {
      els.driftBody.innerHTML = '<div class="drift-empty"><svg class="de-shield" viewBox="0 0 24 24" fill="none" stroke="var(--verified)" stroke-width="1.5"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/><path d="m9 12 2 2 4-4"/></svg>' +
        '<p style="font-weight:650;color:var(--haven-deep)">All clear</p>' +
        '<p style="font-size:.86rem">No anomalies. The feed stays quiet unless integrity drifts or a command is rejected.</p></div>';
      return;
    }
    els.driftBody.innerHTML = "";
    list.forEach(function (a) {
      var div = document.createElement("div");
      div.className = "drift-item";
      div.innerHTML = '<span class="di-dot"></span><div><div class="di-title">' + H.esc(a.label) + '</div>' +
        '<div class="di-meta">seq #' + H.esc(a.seq) + ' · ' + H.esc(H.clockTime(a.ts)) +
        ' · hash ' + H.esc(H.shortHash(a.entry_hash)) + '</div></div>';
      div.style.cursor = "pointer";
      div.addEventListener("click", function () { openModal(a); });
      els.driftBody.appendChild(div);
    });
  }

  /* ---- signing toast (shared by command + kill-switch) ---- */
  async function runSigningToast(toast, title, fn) {
    if (!toast) return fn();
    var steps = ["Canonicalizing payload", "Signing with admin Ed25519 key",
      "Verifying signature locally (sidecar)", "Notarizing to Chain of Trust"];
    toast.classList.add("show");
    toast.innerHTML = '<div style="font-weight:700;color:var(--ink);margin-bottom:.5rem">' + H.esc(title) + '</div>' +
      steps.map(function (s, i) { return '<div class="st-step" data-i="' + i + '"><span class="sp"></span>' + H.esc(s) + '…</div>'; }).join("");
    for (var i = 0; i < steps.length; i++) {
      await new Promise(function (r) { setTimeout(r, 230); });
      var node = toast.querySelector('.st-step[data-i="' + i + '"]'); if (node) node.classList.add("done");
    }
    var res = await fn();
    var block = res && res.data && res.data.block;
    var okSig = res && res.data && (res.data.command_signature || (block && block.signature));
    if (res && res.ok && block) {
      toast.innerHTML += '<div class="st-sig"><b style="color:var(--haven-deep)">Notarized ✓</b> block #' + H.esc(block.seq) +
        ' · verified=' + H.esc(String(res.data.verified !== false)) + '<br>entry: ' + H.esc(block.entry_hash) +
        '<br>sig: ' + H.esc((okSig || "").slice(0, 60)) + '…</div>';
    } else {
      var reason = (res && res.data && (res.data.reason || res.data.error)) || ("HTTP " + (res ? res.status : "?"));
      toast.innerHTML += '<div class="st-sig" style="color:var(--alert)"><b>Rejected:</b> ' + H.esc(reason) + '</div>';
    }
    return res;
  }

  /* ---- commands ------------------------------------------- */
  async function sendCommand(cmd) {
    var d = selDevice(); if (!d) { alert("Enroll a device first."); return; }
    await runSigningToast(els.cmdToast, "Signing: " + cmd, function () { return H.api.command(d.id, cmd); });
    refresh();
  }
  if (els.cmdSend) els.cmdSend.addEventListener("click", function () { sendCommand(els.cmdSelect.value); });
  if (els.quickCmds) els.quickCmds.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-cmd]"); if (b) sendCommand(b.getAttribute("data-cmd"));
  });

  /* ---- kill switch (press & hold) ------------------------- */
  var holdTimer = null, holdStart = 0, HOLD_MS = 1200;
  function holdProgress() {
    var p = Math.min(1, (Date.now() - holdStart) / HOLD_MS);
    if (els.holdFill) els.holdFill.style.width = (p * 100) + "%";
    if (p >= 1) { endHold(true); } else { holdTimer = requestAnimationFrame(holdProgress); }
  }
  function startHold() {
    var d = selDevice(); if (!d) { alert("Enroll a device first."); return; }
    if (d.locked) return;
    holdStart = Date.now(); holdTimer = requestAnimationFrame(holdProgress);
    if (els.holdLabel) els.holdLabel.textContent = "Keep holding to confirm…";
  }
  function endHold(fired) {
    if (holdTimer) cancelAnimationFrame(holdTimer); holdTimer = null;
    if (els.holdFill) els.holdFill.style.width = "0%";
    if (els.holdLabel) els.holdLabel.textContent = "Press & hold to Lock Internet";
    if (fired) doLock();
  }
  async function doLock() {
    var d = selDevice(); if (!d) return;
    await runSigningToast(els.killToast, "High-priority signed kill-switch (LOCK)", function () { return H.api.killswitch(d.id, "lock"); });
    await refresh();
  }
  async function doUnlock() {
    var d = selDevice(); if (!d) return;
    await runSigningToast(els.killToast, "Signed kill-switch (UNLOCK)", function () { return H.api.killswitch(d.id, "unlock"); });
    await refresh();
  }
  if (els.holdBtn) {
    els.holdBtn.addEventListener("pointerdown", function (e) { e.preventDefault(); startHold(); });
    els.holdBtn.addEventListener("pointerup", function () { endHold(false); });
    els.holdBtn.addEventListener("pointerleave", function () { endHold(false); });
    els.holdBtn.addEventListener("keydown", function (e) { if ((e.key === "Enter" || e.key === " ") && !holdTimer) { e.preventDefault(); startHold(); } });
    els.holdBtn.addEventListener("keyup", function () { endHold(false); });
  }
  if (els.unlockBtn) els.unlockBtn.addEventListener("click", doUnlock);

  function renderKill() {
    var d = selDevice();
    if (els.killChild) els.killChild.textContent = d ? (d.child + "'s") : "this device's";
    var locked = d && d.locked;
    if (els.killState) {
      els.killState.textContent = locked ? "Internet Locked" : "Unlocked";
      els.killState.className = "pill " + (locked ? "pill-locked" : "pill-green");
    }
    if (els.holdBtn) els.holdBtn.classList.toggle("hidden", !!locked);
    if (els.holdHint) els.holdHint.classList.toggle("hidden", !!locked);
    if (els.unlockBtn) els.unlockBtn.classList.toggle("hidden", !locked);
  }

  /* ---- simulate (real) drift ------------------------------ */
  if (els.simDrift) els.simDrift.addEventListener("click", async function () {
    els.simDrift.disabled = true; els.simDrift.textContent = "Tampering fixture…";
    try {
      var t = await H.api.driftTamper("bedtime");
      if (t && t.status === 403) { alert("Dev integrity-test tools are disabled on this sidecar (HAVEN_ALLOW_DEV_TOOLS=0)."); return; }
      els.simDrift.textContent = "Scanning…";
      await H.api.driftScan();
      await refresh();
    } finally { els.simDrift.disabled = false; els.simDrift.textContent = "Simulate drift event"; }
  });

  /* ---- child mode toggle (cosmetic density; both visible) - */
  if (els.modeToggle) {
    var saved = "visible"; try { saved = localStorage.getItem("haven.childDensity") || "visible"; } catch (e) {}
    els.modeToggle.querySelectorAll("button").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-mode") === saved);
      b.addEventListener("click", function () {
        var m = b.getAttribute("data-mode");
        try { localStorage.setItem("haven.childDensity", m); } catch (e) {}
        els.modeToggle.querySelectorAll("button").forEach(function (x) { x.classList.toggle("active", x === b); });
      });
    });
  }

  /* ---- refresh loop --------------------------------------- */
  function renderAll() { renderDevices(); renderStatus(); renderKill(); }

  async function refresh() {
    try {
      var st = await H.api.state();
      state.devices = st.devices || [];
      state.integrity = st.integrity || null;
      state.privacy = st.privacy_mode || "proof-only";
      H.cacheState(st);
      if (state.selected && !state.devices.some(function (d) { return d.id === state.selected; })) state.selected = null;
      setBanner("ok", "Live · connected to Haven sidecar at " + H.cfg.apiBase + " · " +
        (state.privacy === "proof-only" ? "proof-only privacy (no message content stored)" : state.privacy));
      renderAll();

      var chain = await H.api.chain(60);
      renderMetrics(chain); renderChain(chain);
      var anoms = await H.api.anomalies(20); renderAnomalies(anoms);
    } catch (e) {
      setBanner("off", "Cannot reach the Haven sidecar at " + H.cfg.apiBase +
        " — start it (haven-web/server/run.sh) or append ?api=<url>. Showing no fabricated data.");
      renderDevices(); renderStatus();
      if (els.chain) els.chain.innerHTML = '<p class="muted" style="text-align:center;padding:2rem">Offline — no live data to show.</p>';
      if (els.driftBody) els.driftBody.innerHTML = '<p class="muted" style="text-align:center;padding:1.5rem">Offline.</p>';
    }
  }

  var pollTimer = null;

  function opsGateUnlocked() {
    if (window.HavenOwnerPasscodeAuth && HavenOwnerPasscodeAuth.isUnlocked && HavenOwnerPasscodeAuth.isUnlocked()) {
      return true;
    }
    if (window.HavenOpsAuth && HavenOpsAuth.isSessionUnlocked && HavenOpsAuth.isSessionUnlocked()) {
      return true;
    }
    return false;
  }

  function startOps() {
    if (pollTimer) return;
    refresh();
    pollTimer = setInterval(refresh, H.cfg.pollMs || 4000);
  }

  if (opsGateUnlocked()) {
    startOps();
  } else {
    window.addEventListener("haven:ops:unlocked", startOps, { once: true });
  }
})();
