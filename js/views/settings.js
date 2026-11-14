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

  function validatePet(v) {
    if (v.birthDate && v.birthDate > U.today()) return "Дата рождения не может быть в будущем";
    return null;
  }

  function petData(v, base) {
    return Object.assign({}, base || {}, {
      name: v.name,
      species: v.species,
      color: v.color,
      breed: v.breed,
      birthDate: v.birthDate,
      sex: v.sex,
      chip: v.chip,
    });
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
      fields: petFields(pet),
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
  function exportBackup() {
    U.download("pet-diary-backup-" + U.today() + ".json", S.exportData(), "application/json");
    S.bump("exports");
    PD.ui.checkAchievements();
    PD.ui.toast("Резервная копия сохранена", { icon: "💾" });
  }

  function importBackup(file) {
    const reader = new FileReader();
    reader.onload = function () {
      PD.ui
        .confirmDialog("Текущие данные будут заменены данными из файла «" + file.name + "». Продолжить?", { okLabel: "Восстановить", danger: true })
        .then(function (ok) {
          if (!ok) return;
          try {
            S.importData(reader.result);
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
    const rows = [["Питомец", "Дата", "Время", "Действие", "Заметка"]];
    S.state.entries
      .slice()
      .sort((a, b) => a.time - b.time)
      .forEach(function (e) {
        const pet = S.state.pets.find((p) => p.id === e.petId);
        rows.push([pet ? pet.name : "", U.toISODate(e.time), U.formatTime(e.time), S.actionInfo(e.type).label, e.note || ""]);
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
    U.$("#storage-warning").hidden = S.storageOk;
  }

  PD.views.settings = { init, render, openPetForm };
  PD.petForm = { fields: petFields, validate: validatePet, data: petData, syncAvatars: syncAvatars };
})(window.PD);
