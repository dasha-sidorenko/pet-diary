// Настройки: питомцы, тема, звук, уведомления, валюта, резервные копии, печать паспорта.
(function (PD) {
  "use strict";

  const U = PD.utils;
  const S = PD.store;
  const el = U.el;
  PD.views = PD.views || {};

  // Поля карточки питомца — общие для онбординга и редактирования
  function petFields(pet) {
    pet = pet || {};
    const species = pet.species || "cat";
    const color = pet.color || "ginger";
    return [
      { name: "name", label: "Кличка", required: true, maxlength: 30, value: pet.name || "", placeholder: "Например, Барсик" },
      {
        name: "species",
        label: "Кто это",
        type: "choice",
        compact: true,
        value: species,
        options: S.SPECIES.map((s) => ({
          value: s.id,
          label: s.label,
          render: () => PD.ui.avatar({ species: s.id, color: color }, "choice-avatar"),
        })),
      },
      {
        name: "color",
        label: "Окрас",
        type: "choice",
        compact: true,
        hideLabels: true,
        value: color,
        options: S.COLORS.map((c) => ({
          value: c.id,
          label: c.label,
          render: () => el("span", { class: "swatch", style: "background:" + PD.sprites.PALETTES[c.id].b }),
        })),
      },
      { name: "breed", label: "Порода", maxlength: 40, value: pet.breed || "", placeholder: "Необязательно" },
      { name: "birthDate", label: "Дата рождения", type: "date", value: pet.birthDate || "", max: U.today() },
      {
        name: "sex",
        label: "Пол",
        type: "select",
        value: pet.sex || "",
        options: [
          { value: "", label: "Не указан" },
          { value: "m", label: "Мальчик" },
          { value: "f", label: "Девочка" },
        ],
      },
      { name: "chip", label: "Номер чипа", maxlength: 20, value: pet.chip || "", placeholder: "Необязательно", inputmode: "numeric" },
    ];
  }

  // Расширенная карточка: режим, питание, здоровье и контакты.
  // Из неё собираются «Памятка для няни» и паспорт для ветеринара.
  const EXTRA_FIELDS = ["feedsPerDay", "walksPerDay", "food", "allergies", "conditions", "temper", "vet", "owner"];

  function extraFields(pet) {
    pet = pet || {};
    const val = (k) => (pet[k] === undefined || pet[k] === null ? "" : pet[k]);
    return [
      { type: "section", name: "_routine", label: "🕒 Режим дня", hint: "По нему строится план на сегодня и скорость, с которой падают шкалы." },
      { name: "feedsPerDay", label: "Кормлений в день", type: "number", inputmode: "numeric", value: val("feedsPerDay"), placeholder: "Например, 2" },
      { name: "walksPerDay", label: "Прогулок в день", type: "number", inputmode: "numeric", value: val("walksPerDay"), placeholder: pet.species === "dog" ? "Например, 3" : "Если гуляет" },
      { name: "food", label: "Корм и порция", maxlength: 120, value: val("food"), placeholder: "Например, Purina Pro Plan, 80 г утром и вечером", wide: true },
      { type: "section", name: "_health", label: "🩺 Здоровье и характер" },
      { name: "allergies", label: "Аллергии и запреты", maxlength: 160, value: val("allergies"), placeholder: "Например, курица, нельзя кости", wide: true },
      { name: "conditions", label: "Хронические болезни", maxlength: 160, value: val("conditions"), placeholder: "Необязательно", wide: true },
      { name: "temper", label: "Характер и привычки", type: "textarea", maxlength: 400, value: val("temper"), placeholder: "Боится фейерверков, тянет поводок, не любит чужих собак" },
      { type: "section", name: "_contacts", label: "📞 Контакты" },
      { name: "vet", label: "Ветклиника и телефон", maxlength: 120, value: val("vet"), placeholder: "Клиника «Айболит», +7 900 000-00-00", wide: true },
      { name: "owner", label: "Телефон хозяина", type: "tel", maxlength: 40, value: val("owner"), placeholder: "Для памятки и паспорта", wide: true },
    ];
  }

  function validatePet(v) {
    if (v.birthDate && v.birthDate > U.today()) return "Дата рождения не может быть в будущем";
    for (const k of ["feedsPerDay", "walksPerDay"]) {
      if (v[k] === "" || v[k] === undefined) continue;
      if (!Number.isInteger(v[k]) || v[k] < 0 || v[k] > 12) return "Число кормлений и прогулок — целое, от 0 до 12";
    }
    return null;
  }

  function petData(v, base) {
    const data = Object.assign({}, base || {}, {
      name: v.name,
      species: v.species,
      color: v.color,
      breed: v.breed,
      birthDate: v.birthDate,
      sex: v.sex,
      chip: v.chip,
    });
    // Онбординг короткий — расширенных полей там нет, их не трогаем
    EXTRA_FIELDS.forEach(function (k) {
      if (k in v) data[k] = v[k] === "" ? "" : v[k];
    });
    return data;
  }

  // Перерисовываем мини-аватарки в выборе вида под выбранный окрас
  function syncAvatars(form, values) {
    U.$$(".choice-avatar", form).forEach(function (canvas, i) {
      PD.sprites.drawAvatar(canvas, S.SPECIES[i].id, values.color || "ginger");
    });
  }

  function openPetForm(pet) {
    const isNew = !pet;
    PD.ui.openForm({
      title: isNew ? "Новый питомец" : "Карточка питомца",
      fields: petFields(pet).concat(extraFields(pet)),
      validate: validatePet,
      onInput: (v) => syncAvatars(U.$("#modal-form"), v),
      onSubmit: function (v) {
        S.savePet(petData(v, pet));
        if (isNew) location.hash = "#home";
      },
      onDelete: isNew
        ? null
        : function () {
            setTimeout(function () {
              PD.ui
                .confirmDialog("Удалить " + pet.name + " и все записи о нём? Это действие не отменить.", { danger: true, okLabel: "Удалить" })
                .then(function (ok) {
                  if (ok) {
                    S.deletePet(pet.id);
                    PD.ui.toast("Питомец удалён", { icon: "🗑️" });
                  }
                });
            }, 50);
          },
    });
  }

  // ---------- Резервные копии ----------
  function usedPhotoIds() {
    return S.state.entries.map((e) => e.photoId).concat(S.state.pets.map((p) => p.photoId)).filter(Boolean);
  }

  // Копия вместе с фото: без них перенос на новый телефон был бы неполным
  function exportBackup() {
    const ids = Array.from(new Set(usedPhotoIds()));
    const photos = ids.length ? PD.photos.exportAll(ids).catch(() => ({})) : Promise.resolve({});
    photos.then(function (map) {
      U.download("pet-diary-backup-" + U.today() + ".json", S.exportData(map), "application/json");
      S.bump("exports");
      PD.ui.checkAchievements();
      const n = Object.keys(map).length;
      const missing = ids.length - n;
      if (missing > 0) {
        // Не все фото удалось прочитать — честно предупреждаем и не считаем копию полной
        PD.ui.toast("Копия сохранена, но без " + missing + " фото: браузер не отдал их из хранилища", { icon: "⚠️", kind: "error", timeout: 7000 });
        return;
      }
      S.updateSettings({ lastExportAt: Date.now(), backupSnoozeUntil: null });
      PD.ui.toast("Резервная копия сохранена" + (n ? " (с фото: " + n + ")" : ""), { icon: "💾" });
    });
  }

  function importBackup(file) {
    const reader = new FileReader();
    reader.onload = function () {
      PD.ui
        .confirmDialog("Текущие данные будут заменены данными из файла «" + file.name + "». Продолжить?", { okLabel: "Восстановить", danger: true })
        .then(function (ok) {
          if (!ok) return;
          try {
            const photos = S.importData(reader.result);
            if (photos) PD.photos.importAll(photos).then(() => PD.app.route());
            PD.ui.toast("Дневник восстановлен", { icon: "✅" });
            location.hash = "#home";
          } catch (err) {
            PD.sound("error");
            PD.ui.toast("Не получилось: " + err.message, { icon: "⚠️", kind: "error" });
          }
        });
    };
    reader.readAsText(file);
  }

  function csvCell(value) {
    const s = String(value === undefined || value === null ? "" : value);
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function exportCSV() {
    const rows = [["Питомец", "Дата", "Время", "Действие", "Заметка", "Кто"]];
    S.state.entries
      .slice()
      .sort((a, b) => a.time - b.time)
      .forEach(function (e) {
        const pet = S.state.pets.find((p) => p.id === e.petId);
        const who = e.by ? PD.family.member(e.by) : null;
        rows.push([pet ? pet.name : "", U.toISODate(e.time), U.formatTime(e.time), S.entryInfo(e).label, e.note || "", who ? who.name : ""]);
      });
    // BOM нужен, чтобы Excel правильно открыл кириллицу; разделитель «;» — для русской локали
    const csv = "﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n");
    U.download("pet-diary-journal-" + U.today() + ".csv", csv, "text/csv;charset=utf-8");
    PD.ui.toast("Журнал выгружен в CSV", { icon: "📊" });
  }

  // ---------- Паспорт питомца для печати ----------
  function printPassport() {
    const pet = S.activePet();
    if (!pet) return;
    const area = U.$("#print-area");
    area.innerHTML = "";
    const species = S.SPECIES.find((s) => s.id === pet.species).label;
    const rows = [
      ["Кличка", pet.name],
      ["Вид", species],
      ["Порода", pet.breed || "—"],
      ["Пол", pet.sex === "m" ? "Мальчик" : pet.sex === "f" ? "Девочка" : "—"],
      ["Дата рождения", pet.birthDate ? U.formatDate(pet.birthDate, true) + " (" + U.formatAge(pet.birthDate) + ")" : "—"],
      ["Номер чипа", pet.chip || "—"],
    ];
    const weights = S.forPet(S.state.weights, pet.id).sort((a, b) => (a.date < b.date ? 1 : -1));
    if (weights.length) rows.push(["Последний вес", weights[0].kg + " кг (" + U.formatDate(weights[0].date, true) + ")"]);
    [
      ["Корм и порция", pet.food],
      ["Аллергии и запреты", pet.allergies],
      ["Хронические болезни", pet.conditions],
      ["Характер и привычки", pet.temper],
      ["Ветклиника", pet.vet],
      ["Телефон хозяина", pet.owner],
    ].forEach((r) => r[1] && rows.push(r));

    const avatar = PD.ui.avatar(pet, "print-avatar");
    area.append(
      el("div", { class: "print-head" }, avatar, el("div", {}, el("h1", { text: "Паспорт питомца" }), el("p", { text: "Сформировано в Pet Diary · " + U.formatDate(U.today(), true) }))),
      el("table", { class: "print-table" }, rows.map((r) => el("tr", {}, el("th", { text: r[0] }), el("td", { text: r[1] }))))
    );

    const health = S.forPet(S.state.health, pet.id).sort((a, b) => (a.date < b.date ? 1 : -1));
    area.append(el("h2", { text: "Медицинская карта" }));
    if (health.length) {
      area.append(
        el(
          "table",
          { class: "print-table" },
          el("tr", {}, ["Дата", "Тип", "Название", "Клиника", "Следующий раз", "Заметка"].map((h) => el("th", { text: h }))),
          health.map((h) =>
            el(
              "tr",
              {},
              [U.formatDate(h.date, true), S.healthKind(h.kind).label, h.title, h.clinic || "", h.nextDate ? U.formatDate(h.nextDate, true) : "", h.note || ""].map((v) => el("td", { text: v }))
            )
          )
        )
      );
    } else {
      area.append(el("p", { text: "Записей нет." }));
    }

    if (weights.length) {
      area.append(el("h2", { text: "Вес" }));
      area.append(
        el(
          "table",
          { class: "print-table" },
          el("tr", {}, el("th", { text: "Дата" }), el("th", { text: "Вес, кг" })),
          weights.slice(0, 20).map((w) => el("tr", {}, el("td", { text: U.formatDate(w.date, true) }), el("td", { text: String(w.kg) })))
        )
      );
    }
    window.print();
  }

  // ---------- Памятка для няни / передержки ----------
  // Всё, что нужно человеку, который остаётся с питомцем: режим, корм, лекарства, запреты, контакты.
  function sitterMemo(pet) {
    const lines = [];
    const species = S.SPECIES.find((s) => s.id === pet.species).label.toLowerCase();
    const about = [species];
    if (pet.breed) about.push(pet.breed);
    const age = U.formatAge(pet.birthDate);
    if (age) about.push(age);
    const weight = S.forPet(S.state.weights, pet.id).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    if (weight) about.push(String(weight.kg).replace(".", ",") + " кг");
    lines.push("🐾 " + pet.name + " — " + about.join(", "));
    lines.push("");

    // Обычное время берём из записей последних двух недель: «обычно в 8:00 и 19:00»
    const usual = function (type) {
      const times = usualTimes(pet.id, type);
      if (!times.length) return "";
      const last = times.pop();
      return ", обычно в " + (times.length ? times.join(", ") + " и " : "") + last;
    };
    const times = (n) => n + " " + U.plural(n, "раз", "раза", "раз") + " в день";
    const routine = [];
    const feeds = Number(pet.feedsPerDay);
    const walks = Number(pet.walksPerDay);
    if (feeds > 0) routine.push("🍖 Кормить " + times(feeds) + usual("feed"));
    if (pet.food) routine.push((feeds > 0 ? "   " : "🍖 ") + "Корм: " + pet.food);
    if (walks > 0) routine.push("🦮 Гулять " + times(walks) + usual("walk"));
    if (routine.length) lines.push("РЕЖИМ", ...routine, "");

    const meds = S.forPet(S.state.health, pet.id).filter(function (h) {
      if (h.kind !== "med" || h.closed) return false;
      const recent = U.daysBetween(U.parseISODate(h.date), new Date()) <= 30;
      return recent || (h.nextDate && h.nextDate >= U.today());
    });
    if (meds.length) {
      lines.push("💊 ЛЕКАРСТВА");
      meds.forEach((m) => lines.push("• " + m.title + (m.note ? " — " + m.note : "")));
      lines.push("");
    }

    if (pet.allergies) lines.push("⛔ НЕЛЬЗЯ: " + pet.allergies);
    if (pet.conditions) lines.push("🩺 Болезни: " + pet.conditions);
    if (pet.temper) lines.push("💡 Важно знать: " + pet.temper);
    if (pet.allergies || pet.conditions || pet.temper) lines.push("");

    const soon = S.reminders(pet.id).filter((r) => r.item && r.days <= 14);
    if (soon.length) {
      lines.push("📅 НЕ ЗАБЫТЬ");
      soon.forEach((r) => lines.push("• " + r.item.title + " — " + U.formatDate(r.item.nextDate)));
      lines.push("");
    }

    if (pet.vet) lines.push("🏥 Ветклиника: " + pet.vet);
    if (pet.owner) lines.push("📞 Хозяин: " + pet.owner);
    if (pet.chip) lines.push("🔖 Чип: " + pet.chip);
    lines.push("", "Памятка из Pet Diary");
    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  // Самые частые часы действия за 14 дней: «8:00, 19:00»
  function usualTimes(petId, type) {
    const since = Date.now() - 14 * U.DAY;
    const hours = {};
    S.forPet(S.state.entries, petId)
      .filter((e) => e.type === type && e.time >= since)
      .forEach(function (e) {
        const h = new Date(e.time).getHours();
        hours[h] = (hours[h] || 0) + 1;
      });
    return Object.keys(hours)
      .filter((h) => hours[h] >= 3)
      .sort((a, b) => hours[b] - hours[a])
      .slice(0, 4)
      .sort((a, b) => a - b)
      .map((h) => h + ":00");
  }

  function openSitterMemo() {
    const pet = S.activePet();
    if (!pet) return;
    const text = sitterMemo(pet);
    const sparse = !pet.food && !pet.feedsPerDay && !pet.vet && !pet.owner;
    const box = PD.ui.openPanel("Памятка для няни");
    box.append(
      el("p", { class: "muted small", text: "Отправь тому, кто остаётся с питомцем: режим, корм, лекарства, запреты и контакты." }),
      sparse
        ? el(
            "p",
            { class: "warning small" },
            "Памятка пока скромная. ",
            el("button", { type: "button", class: "link-btn", text: "Заполни режим и контакты", onclick: () => { PD.ui.closeModal(); setTimeout(() => openPetForm(pet), 50); } }),
            " в карточке питомца."
          )
        : null,
      el("pre", { class: "memo", text: text }),
      el(
        "div",
        { class: "modal-actions" },
        el("span", { class: "spacer" }),
        el("button", { type: "button", class: "btn btn-ghost", text: "📋 Копировать", onclick: () => copyText(text) }),
        navigator.share ? el("button", { type: "button", class: "btn", text: "📤 Отправить", onclick: () => navigator.share({ title: "Памятка: " + pet.name, text: text }).catch(() => {}) }) : null
      )
    );
  }

  function copyText(text) {
    const done = () => PD.ui.toast("Скопировано — вставь в мессенджер", { icon: "📋" });
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else fallback();
    function fallback() {
      const area = el("textarea", { style: "position:fixed;opacity:0" });
      area.value = text;
      document.body.append(area);
      area.select();
      try {
        document.execCommand("copy");
        done();
      } catch {
        PD.ui.toast("Не получилось скопировать", { icon: "⚠️" });
      }
      area.remove();
    }
  }

  // ---------- Погода для прогулок ----------
  function toggleWeather(enabled) {
    if (!enabled) {
      S.updateSettings({ weather: false });
      return;
    }
    PD.weather
      .locate()
      .then(function (loc) {
        S.updateSettings({ weather: true, weatherLoc: loc });
        PD.ui.toast("Погода подключена — смотри на главной", { icon: "🌦️" });
      })
      .catch(function (err) {
        U.$("#set-weather").checked = false;
        PD.ui.toast(err.message || "Не удалось определить место", { icon: "📍" });
      });
  }

  // ---------- Уведомления ----------
  function toggleNotifications(enabled) {
    if (!enabled) {
      S.updateSettings({ notifications: false });
      return;
    }
    if (!("Notification" in window)) {
      PD.ui.toast("Этот браузер не поддерживает уведомления", { icon: "⚠️" });
      U.$("#set-notify").checked = false;
      return;
    }
    Notification.requestPermission().then(function (permission) {
      const ok = permission === "granted";
      S.updateSettings({ notifications: ok, lastNotifiedDay: null });
      U.$("#set-notify").checked = ok;
      if (ok) {
        PD.ui.toast("Будем напоминать при открытии дневника", { icon: "🔔" });
        PD.ui.notifyReminders();
      } else {
        PD.ui.toast("Уведомления запрещены в настройках браузера", { icon: "🔕" });
      }
    });
  }

  function init() {
    U.$("#pet-add").addEventListener("click", () => openPetForm(null));
    U.$("#member-add").addEventListener("click", () => PD.family.openMemberForm(null));
    U.$("#lost-btn").addEventListener("click", () => PD.lost.open());
    U.$("#set-kid").addEventListener("change", (e) => S.updateSettings({ kidMode: e.target.checked }));
    U.$("#set-theme").addEventListener("change", (e) => S.updateSettings({ theme: e.target.value }));
    U.$("#set-sound").addEventListener("change", function (e) {
      S.updateSettings({ sound: e.target.checked });
      PD.sound("tap");
    });
    U.$("#set-notify").addEventListener("change", (e) => toggleNotifications(e.target.checked));
    U.$("#set-currency").addEventListener("change", (e) => S.updateSettings({ currency: e.target.value }));
    U.$("#export-btn").addEventListener("click", exportBackup);
    U.$("#import-btn").addEventListener("click", () => U.$("#import-file").click());
    U.$("#welcome-import").addEventListener("click", () => U.$("#import-file").click());
    U.$("#import-file").addEventListener("change", function (e) {
      const file = e.target.files[0];
      if (file) importBackup(file);
      e.target.value = "";
    });
    U.$("#csv-btn").addEventListener("click", exportCSV);
    U.$("#memo-btn").addEventListener("click", openSitterMemo);
    U.$("#set-weather").addEventListener("change", (e) => toggleWeather(e.target.checked));
    U.$("#print-btn").addEventListener("click", printPassport);
    U.$("#reset-btn").addEventListener("click", function () {
      PD.ui.confirmDialog("Удалить всех питомцев, журнал, медкарту и расходы? Сначала лучше скачать резервную копию.", { danger: true, okLabel: "Стереть всё" }).then(function (ok) {
        if (ok) {
          S.resetAll();
          PD.ui.toast("Все данные удалены", { icon: "🧹" });
        }
      });
    });
  }

  function render() {
    const st = S.state;
    const list = U.$("#pets-list");
    list.innerHTML = "";
    st.pets.forEach(function (pet) {
      const meta = [S.SPECIES.find((s) => s.id === pet.species).label];
      const age = U.formatAge(pet.birthDate);
      if (age) meta.push(age);
      const count = S.forPet(st.entries, pet.id).length;
      meta.push(count + " " + U.plural(count, "запись", "записи", "записей"));
      list.append(
        el(
          "li",
          { class: "list-item" + (pet.id === st.activePetId ? " is-active" : "") },
          PD.ui.avatar(pet, "list-avatar"),
          el("div", { class: "list-body" }, el("strong", { text: pet.name }), el("span", { class: "muted small", text: meta.join(" · ") })),
          el("button", { type: "button", class: "btn btn-small btn-ghost", text: "Изменить", onclick: () => openPetForm(pet) })
        )
      );
    });
    U.$("#set-theme").value = st.settings.theme;
    U.$("#set-sound").checked = !!st.settings.sound;
    U.$("#set-notify").checked = !!st.settings.notifications && "Notification" in window && Notification.permission === "granted";
    U.$("#set-currency").value = st.settings.currency || "RUB";
    U.$("#set-weather").checked = !!st.settings.weather;
    U.$("#set-kid").checked = !!st.settings.kidMode;
    PD.family.renderSettings();
    const backupInfo = U.$("#backup-info");
    backupInfo.textContent = st.settings.lastExportAt ? "Последняя копия: " + U.timeAgo(st.settings.lastExportAt) : "Резервную копию ещё не делали.";
    U.$("#storage-warning").hidden = S.storageOk;
  }

  PD.ui.copyText = copyText;
  PD.views.settings = { init, render, openPetForm, openSitterMemo, exportBackup };
  PD.petForm = { fields: petFields, validate: validatePet, data: petData, syncAvatars: syncAvatars };
})(window.PD);
