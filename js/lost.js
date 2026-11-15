// «Питомец потерялся»: листовка для подъездов и соцсетей и QR-бирка на ошейник.
// QR ведёт на found.html, а все данные лежат в части ссылки после # — на сервер они не уходят.
(function (PD) {
  "use strict";

  const U = PD.utils;
  const S = PD.store;
  const el = U.el;

  const W = 1080;
  const H = 1350;
  const FONT = '"Nunito", "Segoe UI", sans-serif';
  const DEMO_URL = "https://dasha-sidorenko.github.io/pet-diary/found.html";

  function headline(pet) {
    const f = pet.sex === "f";
    const m = pet.sex === "m";
    if (pet.species === "dog") return m ? "ПРОПАЛ ПЁС" : "ПРОПАЛА СОБАКА";
    if (pet.species === "cat") return m ? "ПРОПАЛ КОТ" : "ПРОПАЛА КОШКА";
    if (pet.species === "bird") return "УЛЕТЕЛА ПТИЦА";
    return f ? "ПОТЕРЯЛАСЬ ЛЮБИМИЦА" : "ПОТЕРЯЛСЯ ПИТОМЕЦ";
  }

  // ---------- Ссылка для нашедшего ----------
  function foundBase() {
    if (/^https?:$/.test(location.protocol)) return new URL("found.html", location.href.split("#")[0].split("?")[0]).href;
    return DEMO_URL;
  }

  function encode(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let bin = "";
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function foundUrl(pet, info) {
    const data = { n: pet.name, s: pet.species, p: info.phone || pet.owner || "" };
    if (pet.sex) data.x = pet.sex;
    if (pet.chip) data.c = pet.chip;
    if (pet.allergies) data.a = pet.allergies.slice(0, 80);
    if (info.note) data.m = info.note.slice(0, 80);
    return foundBase() + "#d=" + encode(data);
  }

  // QR как холст: тёмные модули на белом, с «тихой зоной» по краям
  function qrCanvas(text, size) {
    const qr = window.qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    const quiet = 3;
    const cell = Math.floor(size / (n + quiet * 2));
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = cell * (n + quiet * 2);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000000";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell);
    return canvas;
  }

  // ---------- Листовка ----------
  function wrap(ctx, text, maxWidth, maxLines) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    words.forEach(function (w) {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = w;
      } else line = test;
    });
    if (line) lines.push(line);
    if (lines.length > maxLines) {
      lines.length = maxLines;
      lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "") + "…";
    }
    return lines;
  }

  function loadPhoto(id) {
    if (!id) return Promise.resolve(null);
    return PD.photos.url(id).then(function (u) {
      if (!u) return null;
      return new Promise(function (resolve) {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = u;
      });
    });
  }

  function drawFlyer(pet, info, photo) {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // Красная шапка
    ctx.fillStyle = "#e5484d";
    ctx.fillRect(0, 0, W, 170);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let size = 92;
    const title = headline(pet);
    do {
      ctx.font = "900 " + size + "px " + FONT;
      size -= 4;
    } while (ctx.measureText(title).width > W - 80 && size > 40);
    ctx.fillText(title, W / 2, 88);

    // Фото (обрезаем по центру) или крупный портрет из дневника
    const px = 60;
    const py = 200;
    const pw = W - 120;
    const ph = 560;
    ctx.fillStyle = "#f4f0ea";
    ctx.fillRect(px, py, pw, ph);
    if (photo) {
      const k = Math.max(pw / photo.naturalWidth, ph / photo.naturalHeight);
      const sw = pw / k;
      const sh = ph / k;
      ctx.drawImage(photo, (photo.naturalWidth - sw) / 2, (photo.naturalHeight - sh) / 2, sw, sh, px, py, pw, ph);
    } else {
      const sprite = PD.sprites.drawAvatar(document.createElement("canvas"), pet.species, pet.color);
      const k = 420 / sprite.width;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sprite, W / 2 - 210, py + 40, 420, sprite.height * k);
      ctx.imageSmoothingEnabled = true;
    }

    // Кличка и описание
    ctx.fillStyle = "#2a2431";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = "900 76px " + FONT;
    ctx.fillText(pet.name, 60, 790);
    const about = [S.SPECIES.find((s) => s.id === pet.species).label, pet.breed, U.formatAge(pet.birthDate), pet.sex === "m" ? "мальчик" : pet.sex === "f" ? "девочка" : ""].filter(Boolean).join(" · ");
    ctx.font = "600 32px " + FONT;
    ctx.fillStyle = "#776e7c";
    ctx.fillText(about, 62, 880);

    ctx.fillStyle = "#2a2431";
    ctx.font = "600 34px " + FONT;
    let y = 935;
    wrap(ctx, info.signs, W - 120, 3).forEach(function (line) {
      ctx.fillText(line, 60, y);
      y += 44;
    });
    const where = [info.place ? "📍 " + info.place : "", info.date ? "📅 " + U.formatDate(info.date, true) : ""].filter(Boolean).join("   ");
    if (where) {
      ctx.font = "700 32px " + FONT;
      wrap(ctx, where, W - 120, 1).forEach((line) => ctx.fillText(line, 60, y + 6));
    }

    // Низ: вознаграждение, телефон и QR
    const qr = qrCanvas(foundUrl(pet, info), 230);
    ctx.drawImage(qr, W - 60 - 230, H - 60 - 230, 230, 230);
    ctx.font = "700 22px " + FONT;
    ctx.fillStyle = "#776e7c";
    ctx.textAlign = "center";
    ctx.fillText("Наведите камеру", W - 60 - 115, H - 50);
    ctx.textAlign = "left";
    if (info.reward) {
      ctx.fillStyle = "#ffcf3f";
      ctx.fillRect(60, H - 300, W - 120 - 260, 64);
      ctx.fillStyle = "#2a2431";
      ctx.font = "800 34px " + FONT;
      wrap(ctx, "🎁 Вознаграждение: " + info.reward, W - 120 - 290, 1).forEach((line) => ctx.fillText(line, 76, H - 286));
    }
    ctx.fillStyle = "#2a2431";
    ctx.font = "700 30px " + FONT;
    ctx.fillText("Видели? Звоните:", 60, H - 215);
    let phoneSize = 78;
    do {
      ctx.font = "900 " + phoneSize + "px " + FONT;
      phoneSize -= 4;
    } while (ctx.measureText(info.phone).width > W - 120 - 270 && phoneSize > 30);
    ctx.fillStyle = "#e5484d";
    ctx.fillText(info.phone, 58, H - 170);
    if (pet.chip) {
      ctx.fillStyle = "#776e7c";
      ctx.font = "600 26px " + FONT;
      ctx.fillText("Чип: " + pet.chip, 60, H - 75);
    }
    return canvas;
  }

  // ---------- Печать ----------
  function printImage(dataUrl, cls) {
    const area = U.$("#print-area");
    area.innerHTML = "";
    area.append(el("img", { class: cls, src: dataUrl, alt: "" }));
    window.print();
  }

  // Лист с бирками: QR + кличка + телефон, вырезать и вложить в адресник
  function printTags(pet, info) {
    const area = U.$("#print-area");
    area.innerHTML = "";
    const url = qrCanvas(foundUrl(pet, info), 300).toDataURL("image/png");
    const sheet = el("div", { class: "tag-sheet" });
    for (let i = 0; i < 12; i++) {
      sheet.append(
        el(
          "div",
          { class: "tag" },
          el("img", { src: url, alt: "" }),
          el("strong", { text: "Я " + pet.name + "! Если я потерял" + (pet.sex === "f" ? "ась" : "ся") + " — сканируй" }),
          el("span", { text: info.phone })
        )
      );
    }
    area.append(el("p", { class: "tag-hint", text: "Вырежи бирку и вложи в адресник на ошейнике или заламинируй скотчем." }), sheet);
    window.print();
  }

  function toBlob(canvas) {
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  // ---------- Окна ----------
  function showResult(pet, info) {
    const body = PD.ui.openPanel("Листовка готова");
    const img = el("img", { class: "report-preview", alt: "Листовка" });
    const link = foundUrl(pet, info);
    body.append(el("p", { class: "muted small", text: "Распечатай для подъездов и ветклиник, отправь в районные чаты и группы «Потеряшек»." }), img);
    let canvas = null;
    const ready = (document.fonts && document.fonts.load ? document.fonts.load("900 40px " + FONT).catch(() => {}) : Promise.resolve())
      .then(() => loadPhoto(pet.photoId))
      .then(function (photo) {
        canvas = drawFlyer(pet, info, photo);
        img.src = canvas.toDataURL("image/png");
      });
    const file = () => "poteryalsya-" + pet.name + ".png";
    body.append(
      el(
        "div",
        { class: "modal-actions" },
        el("button", { type: "button", class: "btn btn-ghost", text: "🖨️ Печать", onclick: () => ready.then(() => printImage(canvas.toDataURL("image/png"), "print-flyer")) }),
        el("button", { type: "button", class: "btn btn-ghost", text: "🏷️ QR-бирки", onclick: () => printTags(pet, info) }),
        el(
          "button",
          {
            type: "button",
            class: "btn btn-ghost",
            text: "💾 Сохранить",
            onclick: () => ready.then(() => toBlob(canvas)).then((blob) => U.download(file(), blob, "image/png")),
          },
          null
        ),
        navigator.share
          ? el("button", {
              type: "button",
              class: "btn",
              text: "📤 Поделиться",
              onclick: function () {
                ready
                  .then(() => toBlob(canvas))
                  .then(function (blob) {
                    const f = new File([blob], file(), { type: "image/png" });
                    const text = headline(pet) + ": " + pet.name + ". " + (info.signs || "") + " Тел.: " + info.phone;
                    const data = navigator.canShare && navigator.canShare({ files: [f] }) ? { files: [f], text: text } : { text: text + " " + link };
                    navigator.share(data).catch(() => {});
                  });
              },
            })
          : null
      ),
      el("p", { class: "muted small found-link" }, "Ссылка из QR: ", el("button", { type: "button", class: "link-btn", text: "скопировать", onclick: () => PD.ui.copyText(link) }), " — откроется страница с кнопкой «Позвонить».")
    );
  }

  function open() {
    const pet = S.activePet();
    if (!pet) return;
    const prev = pet.lost || {};
    PD.ui.openForm({
      title: "🆘 " + pet.name + " потерял" + (pet.sex === "f" ? "ась" : "ся"),
      noAutofocus: true,
      submitLabel: "Сделать листовку",
      fields: [
        { name: "photo", label: "Фото, где хорошо видно окрас", type: "photo", value: pet.photoId || null },
        { name: "signs", label: "Приметы", type: "textarea", maxlength: 200, value: prev.signs || [pet.breed, pet.temper].filter(Boolean).join(". "), placeholder: "Окрас, ошейник, особые приметы, характер: боится людей, откликается на кличку" },
        { name: "place", label: "Где потерялся", maxlength: 80, value: prev.place || "", placeholder: "Например, парк Сокольники, у пруда" },
        { name: "date", label: "Когда", type: "date", value: prev.date || U.today(), max: U.today() },
        { name: "phone", label: "Телефон для связи", type: "tel", required: true, maxlength: 40, value: prev.phone || pet.owner || "" },
        { name: "reward", label: "Вознаграждение", maxlength: 40, value: prev.reward || "", placeholder: "Необязательно" },
        { name: "note", label: "Важно для нашедшего", maxlength: 80, value: prev.note || "", placeholder: "Например, не подходить резко — убегает", wide: true },
      ],
      onSubmit: function (v) {
        const info = { signs: v.signs, place: v.place, date: v.date, phone: v.phone, reward: v.reward, note: v.note };
        const photo = v.photo ? PD.photos.save(v.photo).catch(() => pet.photoId || null) : Promise.resolve(pet.photoId || null);
        photo.then(function (photoId) {
          S.savePet({ id: pet.id, lost: info, photoId: photoId || "" });
          setTimeout(() => showResult(S.activePet(), info), 80);
        });
      },
    });
  }

  PD.lost = { open, foundUrl, qrCanvas };
})(window.PD);
