// Отчёт за месяц: пиксельная картинка-открытка с итогами — поделиться в мессенджере или показать ветеринару.
(function (PD) {
  "use strict";

  const U = PD.utils;
  const S = PD.store;
  const el = U.el;

  const W = 1080;
  const H = 1350;
  const INK = "#2b1d2e";
  const PIXEL = '"Press Start 2P", monospace';
  const TEXT = '"Nunito", "Segoe UI", sans-serif';

  const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

  function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([document.fonts.load("32px " + PIXEL, "ИТОГИ"), document.fonts.load("800 40px " + TEXT, "Итоги")]).catch(() => {});
  }

  // Пиксельная рамка-карточка как в интерфейсе: обводка и жёсткая тень
  function box(ctx, x, y, w, h, fill) {
    ctx.fillStyle = INK;
    ctx.fillRect(x + 10, y + 10, w, h);
    ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
  }

  function fitText(ctx, text, maxWidth, font, size) {
    let s = size;
    ctx.font = font.replace("{s}", s);
    while (ctx.measureText(text).width > maxWidth && s > 12) {
      s -= 2;
      ctx.font = font.replace("{s}", s);
    }
  }

  function draw(canvas, pet, year, month) {
    const sum = S.monthSummary(pet.id, year, month);
    const prevDate = new Date(year, month - 1, 1);
    const prev = S.monthSummary(pet.id, prevDate.getFullYear(), prevDate.getMonth());
    const ctx = canvas.getContext("2d");
    canvas.width = W;
    canvas.height = H;
    ctx.imageSmoothingEnabled = false;

    // Фон в клетку
    ctx.fillStyle = "#f6eddc";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#e8dcc4";
    for (let x = 0; x < W; x += 24) for (let y = 0; y < H; y += 24) ctx.fillRect(x, y, 4, 4);
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, W, 16);
    ctx.fillRect(0, H - 16, W, 16);
    ctx.fillRect(0, 0, 16, H);
    ctx.fillRect(W - 16, 0, 16, H);

    // Шапка: питомец и заголовок
    const sprite = document.createElement("canvas");
    PD.sprites.drawAvatar(sprite, pet.species, pet.color);
    box(ctx, 70, 70, 250, 250, "#a3dbf7");
    ctx.fillStyle = "#5cbf60";
    ctx.fillRect(70, 270, 250, 50);
    // Портрет растягиваем до 216 px по ширине без сглаживания — пиксели остаются чёткими
    const k = 216 / sprite.width;
    ctx.drawImage(sprite, 0, 0, sprite.width, sprite.height, 87, 80, 216, Math.round(sprite.height * k));

    ctx.fillStyle = INK;
    ctx.textBaseline = "top";
    ctx.font = "34px " + PIXEL;
    ctx.fillText("ИТОГИ", 370, 90);
    fitText(ctx, MONTHS[month].toUpperCase() + " " + year, 640, "{s}px " + PIXEL, 34);
    ctx.fillText(MONTHS[month].toUpperCase() + " " + year, 370, 145);
    fitText(ctx, pet.name, 640, "800 {s}px " + TEXT, 64);
    ctx.fillStyle = "#ff7a45";
    ctx.fillText(pet.name, 370, 205);
    ctx.fillStyle = "#7d6b74";
    ctx.font = "600 30px " + TEXT;
    const ageText = U.formatAge(pet.birthDate);
    ctx.fillText([S.SPECIES.find((s) => s.id === pet.species).label, pet.breed, ageText].filter(Boolean).join(" · "), 370, 285);

    // Плитки с цифрами
    // «≈ 2,5 в день», если в среднем хотя бы раз в день; иначе сравнение с прошлым месяцем
    const perDay = function (n, before) {
      const avg = n / sum.days;
      if (avg >= 1) return "≈ " + String(Math.round(avg * 10) / 10).replace(".", ",") + " в день";
      return delta(n, before);
    };
    const delta = function (a, b) {
      if (!b) return "";
      if (a === b) return "как в прошлом месяце";
      return (a > b ? "▲ " : "▼ ") + Math.abs(a - b) + " к прошлому месяцу";
    };
    const tiles = [
      { icon: "🦮", value: sum.walks, label: U.plural(sum.walks, "прогулка", "прогулки", "прогулок"), sub: perDay(sum.walks, prev.walks) },
      { icon: "🍖", value: sum.feeds, label: U.plural(sum.feeds, "кормление", "кормления", "кормлений"), sub: perDay(sum.feeds, prev.feeds) },
      { icon: "🎾", value: sum.plays, label: "игр и занятий", sub: delta(sum.plays, prev.plays) },
      { icon: "📅", value: sum.activeDays + "/" + sum.days, label: "дней с записями", sub: sum.activeDays === sum.days ? "ни одного пропуска!" : "" },
    ];
    if (sum.weightEnd !== null) {
      const d = sum.weightStart !== null ? Math.round((sum.weightEnd - sum.weightStart) * 100) / 100 : 0;
      tiles.push({ icon: "⚖️", value: String(sum.weightEnd).replace(".", ","), label: "кг сейчас", sub: d ? (d > 0 ? "+" : "") + String(d).replace(".", ",") + " кг за месяц" : "вес стабилен" });
    } else {
      tiles.push({ icon: "📝", value: sum.total, label: U.plural(sum.total, "запись", "записи", "записей"), sub: sum.notes ? sum.notes + " " + U.plural(sum.notes, "заметка", "заметки", "заметок") : "" });
    }
    const money = (n) => U.formatMoney(Math.round(n), S.state.settings.currency);
    tiles.push({ icon: "💰", value: money(sum.spent), label: "на питомца", sub: prev.spent ? "в прошлом месяце " + money(prev.spent) : "" });

    const tw = 440;
    const th = 180;
    const gap = 44;
    tiles.forEach(function (t, i) {
      const x = 70 + (i % 2) * (tw + 60);
      const y = 390 + Math.floor(i / 2) * (th + gap);
      box(ctx, x, y, tw, th, "#fffaf0");
      ctx.textBaseline = "top";
      ctx.font = "48px " + TEXT;
      ctx.fillText(t.icon, x + 24, y + 20);
      ctx.fillStyle = INK;
      fitText(ctx, String(t.value), tw - 120, "800 {s}px " + TEXT, 64);
      ctx.fillText(String(t.value), x + 100, y + 14);
      ctx.font = "700 30px " + TEXT;
      ctx.fillText(t.label, x + 24, y + 92);
      if (t.sub) {
        ctx.fillStyle = "#7d6b74";
        fitText(ctx, t.sub, tw - 48, "600 {s}px " + TEXT, 26);
        ctx.fillText(t.sub, x + 24, y + 134);
      }
      ctx.fillStyle = INK;
    });

    // Здоровье за месяц
    const hy = 390 + 3 * (th + gap) + 16;
    box(ctx, 70, hy, W - 140, 150, "#ffe1d1");
    ctx.fillStyle = INK;
    ctx.font = "22px " + PIXEL;
    ctx.fillText("ЗДОРОВЬЕ", 100, hy + 24);
    ctx.font = "600 28px " + TEXT;
    const events = sum.health.slice(0, 2).map((h) => S.healthKind(h.kind).icon + " " + h.title + " — " + parseInt(h.date.slice(8), 10) + " " + MONTHS_GEN[month]);
    if (!events.length) events.push("Без визитов к врачу — так держать 💪");
    events.forEach(function (line, i) {
      fitText(ctx, line, W - 200, "600 {s}px " + TEXT, 28);
      ctx.fillText(line, 100, hy + 66 + i * 38);
    });

    ctx.fillStyle = "#7d6b74";
    ctx.font = "16px " + PIXEL;
    ctx.textAlign = "center";
    ctx.fillText("PET DIARY", W / 2, H - 58);
    ctx.textAlign = "left";
    return canvas;
  }

  function toBlob(canvas) {
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  function open() {
    const pet = S.activePet();
    if (!pet) return;
    const now = new Date();
    // В первые дни месяца логичнее подвести итоги прошлого
    let cursor = new Date(now.getFullYear(), now.getMonth() - (now.getDate() <= 3 ? 1 : 0), 1);
    const canvas = document.createElement("canvas");
    const img = el("img", { class: "report-preview", alt: "Отчёт за месяц" });
    const title = el("strong", { class: "report-month" });
    const next = el("button", { type: "button", class: "icon-btn", "aria-label": "Следующий месяц", text: "▶" });
    const filename = () => "pet-diary-" + pet.name + "-" + cursor.getFullYear() + "-" + String(cursor.getMonth() + 1).padStart(2, "0") + ".png";

    // ready — промис текущей отрисовки: «Сохранить» и «Поделиться» ждут его,
    // иначе на медленной сети ушла бы пустая картинка до загрузки шрифтов
    let ready = Promise.resolve();

    function redraw() {
      title.textContent = MONTHS[cursor.getMonth()] + " " + cursor.getFullYear();
      next.disabled = cursor.getFullYear() === now.getFullYear() && cursor.getMonth() === now.getMonth();
      ready = fontsReady().then(function () {
        draw(canvas, pet, cursor.getFullYear(), cursor.getMonth());
        img.src = canvas.toDataURL("image/png");
      });
    }

    function shift(n) {
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + n, 1);
      PD.sound("tap");
      redraw();
    }
    next.addEventListener("click", () => shift(1));

    function save() {
      ready.then(() => toBlob(canvas)).then(function (blob) {
        U.download(filename(), blob, "image/png");
        PD.ui.toast("Картинка сохранена", { icon: "🖼️" });
      });
    }

    function share() {
      ready.then(() => toBlob(canvas)).then(function (blob) {
        const file = new File([blob], filename(), { type: "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: "Итоги месяца: " + pet.name }).catch(() => {});
        } else {
          save();
        }
      });
    }

    const body = PD.ui.openPanel("Итоги месяца");
    body.append(
      el("div", { class: "month-nav" }, el("button", { type: "button", class: "icon-btn", "aria-label": "Предыдущий месяц", text: "◀", onclick: () => shift(-1) }), title, next),
      img,
      el(
        "div",
        { class: "modal-actions" },
        el("span", { class: "spacer" }),
        el("button", { type: "button", class: "btn btn-ghost", text: "💾 Сохранить", onclick: save }),
        navigator.share ? el("button", { type: "button", class: "btn", text: "📤 Поделиться", onclick: share }) : null
      )
    );
    redraw();
  }

  PD.report = { open, draw };
})(window.PD);
