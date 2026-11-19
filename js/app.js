// Точка входа: роутинг по hash, шапка, переключатель питомцев, тема, онбординг, PWA.
(function (PD) {
  "use strict";

  const U = PD.utils;
  const S = PD.store;
  const el = U.el;

  const VIEWS = ["home", "journal", "health", "money", "stats", "settings"];
  let current = null;
  let welcomeScene = null;

  function currentView() {
    return current;
  }

  // ---------- Тема ----------
  const darkQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function isDark() {
    const theme = S.state.settings.theme;
    if (theme === "dark") return true;
    if (theme === "light") return false;
    return !!(darkQuery && darkQuery.matches);
  }

  // Детский режим — класс на <html>: крупные кнопки, скрытые расходы
  function applyKidMode() {
    document.documentElement.classList.toggle("kid-mode", PD.family.isKidMode());
  }

  function applyTheme() {
    applyKidMode();
    const theme = S.state.settings.theme;
    if (theme === "auto") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    const btn = U.$("#theme-toggle");
    btn.textContent = isDark() ? "🌙" : "☀️";
    btn.title = isDark() ? "Тёмная тема" : "Светлая тема";
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = isDark() ? "#0d0e13" : "#f3f4f7";
  }

  function applySound() {
    const btn = U.$("#sound-toggle");
    btn.textContent = S.state.settings.sound ? "🔊" : "🔇";
    btn.title = S.state.settings.sound ? "Звук включён" : "Звук выключен";
    btn.setAttribute("aria-pressed", S.state.settings.sound ? "true" : "false");
  }

  // ---------- Шапка ----------
  function renderSwitcher() {
    const box = U.$("#pet-switcher");
    box.innerHTML = "";
    if (S.state.pets.length < 2) return;
    S.state.pets.forEach(function (pet) {
      const active = pet.id === S.state.activePetId;
      box.append(
        el(
          "button",
          {
            type: "button",
            class: "pet-chip" + (active ? " is-active" : ""),
            role: "tab",
            "aria-selected": active ? "true" : "false",
            title: pet.name,
            onclick: function () {
              if (!active) {
                S.setActivePet(pet.id);
                PD.sound("tap");
              }
            },
          },
          PD.ui.avatar(pet, "chip-avatar"),
          el("span", { class: "pet-chip-name", text: pet.name })
        )
      );
    });
  }

  function renderBadge() {
    const pet = S.activePet();
    const badge = U.$("#health-badge");
    const n = pet ? S.reminders(pet.id).filter((r) => r.item && r.days <= 7).length : 0;
    badge.hidden = n === 0;
    badge.textContent = n;
  }

  // ---------- Онбординг ----------
  // Шаг 0: кто будет вести дневник — от ответа зависит режим
  const AUDIENCE = {
    solo: { kidMode: false },
    family: { kidMode: false },
    kid: { kidMode: true },
  };

  function renderWelcomeStep() {
    const asked = !!S.state.settings.audience;
    U.$("#welcome-who").hidden = asked;
    U.$("#welcome-card").hidden = !asked;
  }

  function chooseAudience(who) {
    S.updateSettings(Object.assign({ audience: who }, AUDIENCE[who]));
    PD.sound("tap");
    renderWelcomeStep();
    renderWelcome();
  }

  function renderWelcome() {
    renderWelcomeStep();
    const preview = U.$("#welcome-preview");
    if (!welcomeScene) {
      welcomeScene = new PD.sprites.PetScene(preview);
      welcomeScene.setMood("happy", false);
    }
    welcomeScene.setPet({ species: "cat", color: "ginger" });
    const form = el("form", { class: "welcome-form", novalidate: true });
    U.$("#welcome-form").innerHTML = "";
    U.$("#welcome-form").append(form);
    PD.ui.buildForm(form, {
      fields: PD.petForm.fields(null),
      submitLabel: "Начать дневник 🐾",
      validate: PD.petForm.validate,
      onInput: function (v) {
        PD.petForm.syncAvatars(form, v);
        welcomeScene.setPet({ species: v.species, color: v.color });
      },
      onSubmit: function (v) {
        S.savePet(PD.petForm.data(v));
        PD.ui.toast("Добро пожаловать, " + v.name + "!", { icon: "🎉" });
        location.hash = "#home";
        setTimeout(() => PD.views.home.celebrate(), 300);
        // Семье сразу предлагаем добавить первого человека — того, кто держит телефон
        if (S.state.settings.audience === "family" && !S.state.members.length) {
          setTimeout(function () {
            PD.ui.toast("Добавь себя, а потом остальных в «Настройки → Семья»", { icon: "👨‍👩‍👧", timeout: 5000 });
            PD.family.openMemberForm(null);
          }, 900);
        }
      },
    });
  }

  // ---------- Роутинг ----------
  function route() {
    let name = location.hash.replace("#", "") || "home";
    if (!VIEWS.includes(name)) name = "home";
    if (!S.state.pets.length && name !== "settings") name = "welcome";
    // В детском режиме расходы скрыты
    if (name === "money" && PD.family.isKidMode()) name = "home";
    const changed = name !== current;
    current = name;

    U.$$(".view").forEach((v) => (v.hidden = v.dataset.view !== name));
    U.$$("#tabbar a").forEach(function (a) {
      const active = a.dataset.tab === name;
      a.classList.toggle("is-active", active);
      if (active) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    U.$("#app").classList.toggle("is-onboarding", name === "welcome");

    if (name === "welcome") renderWelcome();
    else renderCurrent();
    if (changed) window.scrollTo(0, 0);
  }

  function renderCurrent() {
    applyTheme();
    applySound();
    renderSwitcher();
    renderBadge();
    PD.family.renderTopbar();
    if (current && current !== "welcome" && PD.views[current]) PD.views[current].render();
  }

  // ---------- Запуск ----------
  function init() {
    PD.sprites.drawAvatar(U.$("#logo-icon"), "cat", "ginger");

    Object.keys(PD.views).forEach(function (key) {
      if (PD.views[key] && typeof PD.views[key].init === "function") PD.views[key].init();
    });

    U.$$(".who-option").forEach((b) => b.addEventListener("click", () => chooseAudience(b.dataset.who)));
    U.$("#member-btn").addEventListener("click", () => PD.family.openPicker());

    U.$("#theme-toggle").addEventListener("click", function () {
      S.updateSettings({ theme: isDark() ? "light" : "dark" });
      PD.sound("tap");
    });
    U.$("#sound-toggle").addEventListener("click", function () {
      S.updateSettings({ sound: !S.state.settings.sound });
      PD.sound("tap");
    });
    if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener("change", applyTheme);

    PD.ui.onUnlock = function () {
      if (current === "home") PD.views.home.celebrate();
    };

    let checkTimer = null;
    S.subscribe(function () {
      // Если питомцев не осталось — возвращаемся к онбордингу
      if (!S.state.pets.length && current !== "welcome" && current !== "settings") {
        route();
        return;
      }
      if (S.state.pets.length && current === "welcome") {
        route();
        return;
      }
      renderCurrent();
      clearTimeout(checkTimer);
      checkTimer = setTimeout(PD.ui.checkAchievements, 400);
    });

    window.addEventListener("hashchange", route);
    route();

    // День рождения — праздник на главной
    const pet = S.activePet();
    if (pet && U.daysToBirthday(pet.birthDate) === 0) {
      setTimeout(function () {
        PD.views.home.celebrate();
        PD.ui.toast("С днём рождения, " + pet.name + "! 🎂", { icon: "🎉", kind: "gold", timeout: 6000 });
      }, 800);
    }

    setTimeout(PD.ui.checkAchievements, 1000);
    setTimeout(PD.ui.notifyReminders, 1500);

    // Ярлык с иконки приложения: «Покормил», «Погулял» (?do=feed)
    const shortcut = new URLSearchParams(location.search).get("do");
    if (shortcut) {
      history.replaceState(null, "", location.pathname + "#home");
      setTimeout(() => PD.views.home.runShortcut(shortcut), 600);
    }

    // Подчищаем фото, на которые больше нет ссылок (удалённые записи)
    setTimeout(function () {
      PD.photos.cleanup(() => S.state.entries.map((e) => e.photoId).concat(S.state.pets.map((p) => p.photoId)).filter(Boolean));
    }, 5000);

    // Офлайн-режим и установка на телефон (работает только по http/https)
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("sw.js").catch(function () {
        // Без офлайн-режима приложение всё равно работает
      });
    }
  }

  PD.app = { currentView, route };
  init();
})(window.PD);
