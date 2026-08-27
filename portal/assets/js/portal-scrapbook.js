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
 * My Haven Scrapbook — drag-and-drop ideas, photos, homework canvas.
 */
(function () {
  "use strict";

  var auth = window.HavenPortalAuth;
  if (!auth) return;

  var NOTE_COLORS = [
    "#fff9c4", "#ffcdd2", "#c8e6c9", "#bbdefb", "#e1bee7",
    "#ffe0b2", "#f8bbd0", "#b2ebf2", "#dcedc8", "#ffccbc",
  ];
  var STICKERS = ["⭐", "✨", "🌈", "🎨", "📌", "💡", "🎯", "🦋", "🌸", "🎉"];
  var SUBJECTS = ["Math", "English", "Science", "Other"];
  var saveTimer = null;
  var slug = "";
  var items = [];
  var dragState = null;

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s || "";
    return d.innerHTML;
  }

  function api(path, opts) {
    return auth.api("/" + slug + path, opts || {});
  }

  function photoUrl(content) {
    if (!content) return "";
    if (content.indexOf("data:image") === 0) return content;
    if (content.indexOf("/api/") === 0) {
      var sess = auth.getSession();
      var tok = sess && sess.token ? sess.token : "";
      return content + (content.indexOf("?") >= 0 ? "&" : "?") + "session=" + encodeURIComponent(tok);
    }
    return content;
  }

  function showSparkle() {
    var board = $("scrapbookBoard");
    if (!board) return;
    board.classList.add("mh-scrap-sparkle");
    setTimeout(function () { board.classList.remove("mh-scrap-sparkle"); }, 1200);
  }

  function loadItems() {
    return api("/scrapbook/items").then(function (res) {
      items = res.items || [];
      renderBoard();
    });
  }

  function scheduleSave(itemId, patch) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      api("/scrapbook/items/" + itemId, { method: "PATCH", body: patch })
        .then(function () { showSparkle(); })
        .catch(function () {});
    }, 350);
  }

  function itemHtml(item) {
    var rot = item.rotation || 0;
    var style = "left:" + item.position_x + "px;top:" + item.position_y + "px;" +
      "transform:rotate(" + rot + "deg);";
    var tape = '<div class="mh-scrap-tape" aria-hidden="true"></div>';

    if (item.type === "photo") {
      return '<div class="mh-scrap-item mh-scrap-photo" data-id="' + esc(item.id) + '" style="' + style + '">' +
        tape +
        '<img src="' + esc(photoUrl(item.content)) + '" alt="Scrapbook photo" draggable="false" />' +
        '<button type="button" class="mh-scrap-del" aria-label="Remove">×</button></div>';
    }

    if (item.type === "homework") {
      var meta = item.meta || {};
      var due = meta.due_date ? '<span class="mh-scrap-due">Due ' + esc(meta.due_date) + "</span>" : "";
      return '<div class="mh-scrap-item mh-scrap-homework" data-id="' + esc(item.id) + '" style="' + style +
        "background:" + esc(item.color || "#bbdefb") + '">' +
        tape +
        '<div class="mh-scrap-hw-head"><span class="mh-scrap-subject">' + esc(meta.subject || "Other") + "</span>" + due + "</div>" +
        '<div class="mh-scrap-hw-title">' + esc(meta.title || "Homework") + "</div>" +
        '<div class="mh-scrap-hw-body">' + esc(item.content) + "</div>" +
        '<button type="button" class="mh-scrap-del" aria-label="Remove">×</button></div>';
    }

    return '<div class="mh-scrap-item mh-scrap-idea" data-id="' + esc(item.id) + '" style="' + style +
      "background:" + esc(item.color || "#fff9c4") + '">' +
      tape +
      '<div class="mh-scrap-idea-text">' + esc(item.content) + "</div>" +
      '<button type="button" class="mh-scrap-del" aria-label="Remove">×</button></div>';
  }

  function refreshWidgetThumb() {
    var thumb = $("scrapWidgetThumb");
    if (!thumb) return;
    var photoItem = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].type === "photo" && items[i].content) {
        photoItem = items[i];
        break;
      }
    }
    if (photoItem) {
      thumb.innerHTML = '<img src="' + esc(photoUrl(photoItem.content)) +
        '" alt="Scrapbook photo" class="mh-scrap-widget-img" />';
    } else {
      thumb.innerHTML = '<span class="mh-scrap-widget-placeholder" aria-hidden="true">📷</span>';
    }
  }

  function renderBoard() {
    var board = $("scrapbookBoard");
    var empty = $("scrapbookEmpty");
    if (!board) return;
    if (!items.length) {
      board.innerHTML = "";
      if (empty) empty.classList.remove("hidden");
      refreshWidgetThumb();
      return;
    }
    if (empty) empty.classList.add("hidden");
    board.innerHTML = items.map(itemHtml).join("");
    bindItems();
    board.querySelectorAll(".mh-scrap-item").forEach(function (el, i) {
      if (i % 3 === 0) el.classList.add("mh-scrap-float");
    });
    refreshWidgetThumb();
  }

  function bindItems() {
    var board = $("scrapbookBoard");
    if (!board) return;
    board.querySelectorAll(".mh-scrap-item").forEach(function (el) {
      var id = el.getAttribute("data-id");
      el.addEventListener("pointerdown", function (e) {
        if (e.target.closest(".mh-scrap-del")) return;
        startDrag(el, id, e);
      });
      var del = el.querySelector(".mh-scrap-del");
      if (del) {
        del.addEventListener("click", function (e) {
          e.stopPropagation();
          if (!confirm("Remove this from your scrapbook?")) return;
          api("/scrapbook/items/" + id, { method: "DELETE" }).then(function () {
            items = items.filter(function (it) { return it.id !== id; });
            renderBoard();
          });
        });
      }
    });
  }

  function startDrag(el, id, e) {
    if (e.button !== 0) return;
    var board = $("scrapbookBoard");
    if (!board) return;
    var rect = board.getBoundingClientRect();
    var itemRect = el.getBoundingClientRect();
    dragState = {
      id: id,
      el: el,
      offsetX: e.clientX - itemRect.left,
      offsetY: e.clientY - itemRect.top,
      boardRect: rect,
    };
    el.setPointerCapture(e.pointerId);
    el.classList.add("mh-scrap-dragging");
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!dragState) return;
    var board = dragState.boardRect;
    var x = e.clientX - board.left - dragState.offsetX;
    var y = e.clientY - board.top - dragState.offsetY;
    x = Math.max(0, Math.min(x, board.width - 80));
    y = Math.max(0, Math.min(y, board.height - 60));
    dragState.el.style.left = x + "px";
    dragState.el.style.top = y + "px";
  }

  function onPointerUp(e) {
    if (!dragState) return;
    var el = dragState.el;
    var id = dragState.id;
    el.classList.remove("mh-scrap-dragging");
    try { el.releasePointerCapture(e.pointerId); } catch (err) {}
    var x = parseFloat(el.style.left) || 0;
    var y = parseFloat(el.style.top) || 0;
    el.classList.add("mh-scrap-drop-bounce");
    setTimeout(function () { el.classList.remove("mh-scrap-drop-bounce"); }, 550);
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) {
        items[i].position_x = x;
        items[i].position_y = y;
        break;
      }
    }
    scheduleSave(id, { position_x: x, position_y: y });
    dragState = null;
  }

  function addIdea(text, color) {
    return api("/scrapbook/items", {
      method: "POST",
      body: { type: "idea", content: text, color: color || NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)] },
    }).then(function (res) {
      items.push(res.item);
      renderBoard();
      showSparkle();
    });
  }

  function addHomework(data) {
    return api("/scrapbook/items", {
      method: "POST",
      body: {
        type: "homework",
        content: data.content,
        title: data.title,
        subject: data.subject,
        due_date: data.due_date || "",
        color: "#bbdefb",
      },
    }).then(function (res) {
      items.push(res.item);
      renderBoard();
      showSparkle();
    });
  }

  function uploadPhoto(file, x, y) {
    return new Promise(function (resolve, reject) {
      if (!file || !file.type || file.type.indexOf("image/") !== 0) {
        reject(new Error("Please drop an image file"));
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        reject(new Error("Photo must be under 2 MB"));
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var b64 = reader.result;
        api("/scrapbook/upload", {
          method: "POST",
          body: {
            image: b64,
            mime_type: file.type,
            position_x: x,
            position_y: y,
          },
        }).then(function (res) {
          items.push(res.item);
          renderBoard();
          showSparkle();
          var board = $("scrapbookBoard");
          var last = board && board.querySelector(".mh-scrap-item:last-child");
          if (last) {
            last.classList.add("mh-scrap-drop-bounce");
            setTimeout(function () { last.classList.remove("mh-scrap-drop-bounce"); }, 550);
          }
          resolve(res.item);
        }).catch(reject);
      };
      reader.onerror = function () { reject(new Error("Could not read file")); };
      reader.readAsDataURL(file);
    });
  }

  function bindDropZone() {
    var board = $("scrapbookBoard");
    var wrap = $("scrapbookWrap");
    if (!board || !wrap) return;

    function handleDrop(e) {
      e.preventDefault();
      wrap.classList.remove("mh-scrap-drop-active");
      var rect = board.getBoundingClientRect();
      var x = e.clientX - rect.left - 40;
      var y = e.clientY - rect.top - 40;
      var files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length) {
        uploadPhoto(files[0], Math.max(0, x), Math.max(0, y)).catch(function (err) {
          alert(err.message || "Upload failed");
        });
        return;
      }
      var text = e.dataTransfer.getData("text/plain");
      if (text) addIdea(text);
    }

    ["dragenter", "dragover"].forEach(function (ev) {
      wrap.addEventListener(ev, function (e) {
        e.preventDefault();
        wrap.classList.add("mh-scrap-drop-active");
      });
    });
    wrap.addEventListener("dragleave", function () {
      wrap.classList.remove("mh-scrap-drop-active");
    });
    wrap.addEventListener("drop", handleDrop);
    board.addEventListener("drop", handleDrop);
  }

  function bindToolbar() {
    var addIdeaBtn = $("scrapAddIdea");
    var addHwBtn = $("scrapAddHomework");
    var photoInput = $("scrapPhotoInput");
    var stickerBar = $("scrapStickerBar");

    if (addIdeaBtn) {
      addIdeaBtn.addEventListener("click", function () {
        var text = prompt("What's your idea? ✨");
        if (text && text.trim()) addIdea(text.trim());
      });
    }

    if (addHwBtn) {
      addHwBtn.addEventListener("click", function () {
        var title = prompt("Homework title:");
        if (!title || !title.trim()) return;
        var content = prompt("Notes or details (optional):") || "";
        var subject = prompt("Subject (Math, English, Science, Other):", "Math") || "Other";
        var due = prompt("Due date (optional, e.g. Fri 15 Mar):") || "";
        addHomework({ title: title.trim(), content: content.trim(), subject: subject.trim(), due_date: due.trim() });
      });
    }

    if (photoInput) {
      photoInput.addEventListener("change", function () {
        var file = photoInput.files && photoInput.files[0];
        if (file) {
          uploadPhoto(file, 80, 80).catch(function (err) { alert(err.message); });
          photoInput.value = "";
        }
      });
    }

    if (stickerBar) {
      stickerBar.innerHTML = STICKERS.map(function (s) {
        return '<button type="button" class="mh-scrap-sticker-btn" data-sticker="' + s + '">' + s + "</button>";
      }).join("");
      stickerBar.querySelectorAll(".mh-scrap-sticker-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          btn.classList.add("mh-sticker-pop");
          setTimeout(function () { btn.classList.remove("mh-sticker-pop"); }, 400);
          addIdea(btn.getAttribute("data-sticker") + " Sticker idea!", NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)]);
        });
      });
    }
  }

  function bindGlobalPointer() {
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
  }

  window.HavenScrapbook = {
    init: function (orgSlug, enabled) {
      slug = orgSlug || "";
      var section = $("sectionScrapbook");
      var widget = $("scrapbookWidget");
      if (!section && !widget) return;
      if (!enabled) {
        if (section) section.classList.add("hidden");
        if (widget) widget.classList.add("hidden");
        return;
      }
      if (section && !document.body.classList.contains("mh-sanctuary-mode")) {
        section.classList.remove("hidden");
      }
      if (widget && document.body.classList.contains("mh-aurora-mode")) {
        widget.classList.remove("hidden");
      }
      bindToolbar();
      bindDropZone();
      bindGlobalPointer();
      loadItems().catch(function () {});
    },
    open: function () {
      var el = $("sectionScrapbook");
      if (el) {
        el.classList.remove("hidden");
        el.classList.add("mh-scrap-open");
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    getItems: function () { return items.slice(); },
    photoUrl: photoUrl,
    refreshWidget: refreshWidgetThumb,
  };
})();
