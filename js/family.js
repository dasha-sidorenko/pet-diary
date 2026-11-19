// Семья: кто ведёт дневник, кто что сделал, обязанности для детей и звёзды за неделю.
(function (PD) {
  "use strict";

  const U = PD.utils;
  const S = PD.store;
  const el = U.el;

  const EMOJIS = ["👩", "👨", "👧", "👦", "👵", "👴", "🧑", "🧒", "👶", "🙂"];
  const DAYS = [
    { value: "all", label: "Каждый день" },
    { value: "weekdays", label: "По будням" },
    { value: "weekends", label: "По выходным" },
  ];

  function members() {
    return S.state.members;
  }

  function member(id) {
    return S.state.members.find((m) => m.id === id) || null;
  }

  function current() {
    return member(S.state.settings.memberId);
  }

  function label(m) {
    return m ? (m.emoji || "🙂") + " " + m.name : "";
  }

  function isKidMode() {
    const me = current();
    return !!(S.state.settings.kidMode || (me && me.kid));
  }

  // ---------- Обязанности ----------
  function activeOn(chore, date) {
    const dow = date.getDay(); // 0 — воскресенье
    const weekend = dow === 0 || dow === 6;
    if (chore.days === "weekdays") return !weekend;
    if (chore.days === "weekends") return weekend;
    return true;
  }

  function doneOn(chore, date) {
    const key = U.toISODate(date);
    return S.state.entries.filter((e) => e.petId === chore.petId && e.type === chore.type && e.by === chore.memberId && U.toISODate(e.time) === key).length;
  }

  function todayChores(petId) {
    const now = new Date();
    return S.state.chores
      .filter((c) => (!petId || c.petId === petId) && member(c.memberId) && activeOn(c, now))
      .map((c) => ({ chore: c, member: member(c.memberId), done: doneOn(c, now), times: Number(c.times) || 1 }));
  }

  // Звёзды с понедельника: одна за каждое выполненное дело
  function weekStars(memberId) {
    const m = member(memberId);
    const start = U.startOfDay(new Date());
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    let stars = 0;
    const today = U.startOfDay(new Date());
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      S.state.chores
        .filter((c) => c.memberId === memberId && activeOn(c, d))
        .forEach((c) => (stars += Math.min(doneOn(c, d), Number(c.times) || 1)));
    }
    return { stars: stars, goal: m && m.goal > 0 ? Number(m.goal) : 0, reward: m ? m.reward : "" };
  }

  function completeChore(chore) {
    const before = weekStars(chore.memberId);
    const action = S.actionInfo(chore.type);
    S.addEntry(chore.type, "", Date.now(), { by: chore.memberId, petId: chore.petId });
    PD.sound("achievement");
    const m = member(chore.memberId);
    const after = weekStars(chore.memberId);
    if (after.goal && before.stars < after.goal && after.stars >= after.goal) {
      PD.ui.toast(m.name + ", цель недели выполнена! " + (after.reward ? "Награда: " + after.reward : "Ты супер!"), { icon: "🏆", kind: "gold", timeout: 7000 });
      if (PD.views.home) PD.views.home.celebrate();
    } else {
      PD.ui.toast("+1 ⭐ " + m.name + ": " + action.label.toLowerCase(), { icon: action.icon });
    }
    if (PD.views.home) PD.views.home.react(action);
  }

  // ---------- Формы ----------
  function openMemberForm(m) {
    const isNew = !m;
    PD.ui.openForm({
      title: isNew ? "Член семьи" : "Изменить: " + m.name,
      fields: [
        { name: "name", label: "Имя", required: true, maxlength: 20, value: m ? m.name : "", placeholder: "Например, Маша или Папа" },
        { name: "emoji", label: "Значок", type: "choice", compact: true, hideLabels: true, value: m ? m.emoji : "🙂", options: EMOJIS.map((e) => ({ value: e, label: e, icon: e })) },
        {
          name: "kid",
          label: "Кто это",
          type: "select",
          value: m && m.kid ? "1" : "",
          options: [
            { value: "", label: "Взрослый" },
            { value: "1", label: "Ребёнок — простой режим и звёзды" },
          ],
        },
        { name: "goal", label: "Цель звёзд на неделю", type: "number", inputmode: "numeric", value: m && m.goal ? m.goal : "", placeholder: "Например, 10", hint: "За каждое выполненное дело — звезда" },
        { name: "reward", label: "Награда за цель", maxlength: 60, value: m ? m.reward || "" : "", placeholder: "Например, поход в кино", wide: true },
      ],
      validate: function (v) {
        if (v.goal !== "" && (!Number.isInteger(v.goal) || v.goal < 1 || v.goal > 200)) return "Цель — целое число от 1 до 200";
        return null;
      },
      onSubmit: function (v) {
        const data = { name: v.name, emoji: v.emoji, kid: v.kid === "1", goal: v.goal === "" ? 0 : v.goal, reward: v.reward };
        if (isNew) {
          data.id = U.uid();
          S.state.members.push(data);
          // Первый добавленный — тот, кто сейчас держит телефон
          if (!S.state.settings.memberId) S.state.settings.memberId = data.id;
          S.commit();
        } else {
          S.updateItem("members", m.id, data);
        }
      },
      onDelete: isNew
        ? null
        : function () {
            S.state.chores = S.state.chores.filter((c) => c.memberId !== m.id);
            S.state.members = S.state.members.filter((x) => x.id !== m.id);
            // Переключаемся на взрослого, а не на первого в списке: иначе удаление себя
            // молча включило бы детский режим и спрятало у родителя расходы и настройки
            if (S.state.settings.memberId === m.id) {
              const adult = S.state.members.find((x) => !x.kid);
              S.state.settings.memberId = adult ? adult.id : null;
            }
            S.commit();
            PD.ui.toast(m.name + " больше не в списке семьи", { icon: "👋" });
          },
    });
  }

  function openChoreForm(chore, presetMemberId) {
    const isNew = !chore;
    const list = members();
    if (!list.length) {
      PD.ui.toast("Сначала добавь членов семьи", { icon: "👨‍👩‍👧" });
      return;
    }
    const kidsFirst = list.slice().sort((a, b) => (b.kid ? 1 : 0) - (a.kid ? 1 : 0));
    PD.ui.openForm({
      title: isNew ? "Новая обязанность" : "Обязанность",
      noAutofocus: true,
      fields: [
        { name: "memberId", label: "Кто отвечает", type: "select", value: chore ? chore.memberId : presetMemberId || kidsFirst[0].id, options: kidsFirst.map((m) => ({ value: m.id, label: label(m) })) },
        { name: "type", label: "Что делать", type: "choice", compact: true, value: chore ? chore.type : "walk", options: S.ACTIONS.map((a) => ({ value: a.type, label: a.label, icon: a.icon })) },
        { name: "times", label: "Сколько раз в день", type: "number", inputmode: "numeric", value: chore ? chore.times : 1 },
        { name: "days", label: "Когда", type: "select", value: chore ? chore.days : "all", options: DAYS },
      ],
      validate: function (v) {
        if (!Number.isInteger(v.times) || v.times < 1 || v.times > 10) return "Сколько раз в день — от 1 до 10";
        return null;
      },
      onSubmit: function (v) {
        const data = { memberId: v.memberId, type: v.type, times: v.times, days: v.days };
        if (isNew) S.addItem("chores", data);
        else S.updateItem("chores", chore.id, data);
      },
      onDelete: isNew ? null : () => PD.ui.removeWithUndo("chores", chore.id, "Обязанность удалена"),
    });
  }

  // «Кто сейчас пользуется дневником» — выбор крупными кнопками
  function openPicker() {
    const body = PD.ui.openPanel("Кто сейчас с питомцем?");
    body.append(
      el("p", { class: "muted small", text: "Новые записи будут подписаны этим именем — так видно, кто уже покормил." }),
      el(
        "div",
        { class: "member-grid" },
        members().map((m) =>
          el(
            "button",
            {
              type: "button",
              class: "member-pick" + (m.id === S.state.settings.memberId ? " is-active" : ""),
              onclick: function () {
                S.updateSettings({ memberId: m.id });
                PD.ui.closeModal();
                PD.sound("tap");
                if (PD.views.home) PD.views.home.greet();
              },
            },
            el("span", { class: "member-emoji", text: m.emoji || "🙂" }),
            el("span", { text: m.name })
          )
        )
      ),
      el("div", { class: "modal-actions" }, el("button", { type: "button", class: "btn btn-ghost", text: "＋ Добавить", onclick: () => { PD.ui.closeModal(); setTimeout(() => openMemberForm(null), 50); } }))
    );
  }

  // ---------- Отрисовка ----------
  function renderTopbar() {
    const btn = U.$("#member-btn");
    const me = current();
    btn.hidden = !me;
    if (me) {
      btn.textContent = me.emoji || "🙂";
      btn.title = "Сейчас пользуется: " + me.name + ". Нажми, чтобы сменить";
      btn.setAttribute("aria-label", btn.title);
    }
  }

  function renderSettings() {
    const list = U.$("#family-list");
    list.innerHTML = "";
    if (!members().length) {
      list.append(el("li", { class: "empty-inline muted", text: "Добавь членов семьи — и в журнале будет видно, кто покормил и погулял. Детям можно дать обязанности и копить звёзды." }));
    }
    members().forEach(function (m) {
      const chores = S.state.chores.filter((c) => c.memberId === m.id);
      const meta = [m.kid ? "ребёнок" : "взрослый"];
      if (chores.length) meta.push(chores.map((c) => S.actionInfo(c.type).icon).join(" "));
      if (m.kid && m.goal) meta.push("⭐ " + weekStars(m.id).stars + "/" + m.goal);
      list.append(
        el(
          "li",
          { class: "list-item" + (m.id === S.state.settings.memberId ? " is-active" : "") },
          el("span", { class: "list-icon", text: m.emoji || "🙂" }),
          el("div", { class: "list-body" }, el("strong", { text: m.name }), el("span", { class: "muted small", text: meta.join(" · ") })),
          el(
            "div",
            { class: "list-actions" },
            el("button", { type: "button", class: "btn btn-small btn-ghost", text: "＋ Дело", onclick: () => openChoreForm(null, m.id) }),
            el("button", { type: "button", class: "icon-btn small", "aria-label": "Изменить", text: "✎", onclick: () => openMemberForm(m) })
          )
        )
      );
      chores.forEach(function (c) {
        const pet = S.state.pets.find((p) => p.id === c.petId);
        const info = S.actionInfo(c.type);
        const days = DAYS.find((d) => d.value === c.days) || DAYS[0];
        list.append(
          el(
            "li",
            { class: "list-item chore-line" },
            el("span", { class: "list-icon", text: info.icon }),
            el("div", { class: "list-body" }, el("span", { text: info.label + (c.times > 1 ? " × " + c.times : "") }), el("span", { class: "muted small", text: (pet ? pet.name + " · " : "") + days.label.toLowerCase() })),
            el("button", { type: "button", class: "icon-btn small", "aria-label": "Изменить обязанность", text: "✎", onclick: () => openChoreForm(c) })
          )
        );
      });
    });
  }

  // Карточка «Обязанности» на главной
  function renderHome(pet) {
    const card = U.$("#chores-card");
    const box = U.$("#chores");
    const items = todayChores(pet.id);
    card.hidden = !items.length;
    box.innerHTML = "";
    if (!items.length) return;
    const me = current();
    // Свои дела — сверху
    items.sort((a, b) => (b.member === me ? 1 : 0) - (a.member === me ? 1 : 0));
    items.forEach(function (it) {
      const info = S.actionInfo(it.chore.type);
      const complete = it.done >= it.times;
      box.append(
        el(
          "div",
          { class: "chore" + (complete ? " is-done" : "") },
          el("span", { class: "chore-icon", text: info.icon, "aria-hidden": "true" }),
          el(
            "div",
            { class: "chore-body" },
            el("strong", { text: info.label + (it.times > 1 ? " " + Math.min(it.done, it.times) + "/" + it.times : "") }),
            el("span", { class: "muted small", text: label(it.member) })
          ),
          complete
            ? el("span", { class: "chore-done", text: "⭐", "aria-label": "Сделано" })
            : el("button", { type: "button", class: "btn btn-small", text: "Готово!", onclick: () => completeChore(it.chore) })
        )
      );
    });
    // Прогресс звёзд у детей
    members()
      .filter((m) => m.kid && m.goal && items.some((it) => it.member === m))
      .forEach(function (m) {
        const w = weekStars(m.id);
        const left = Math.max(0, w.goal - w.stars);
        box.append(
          el(
            "div",
            { class: "stars" },
            el("div", { class: "stars-head" }, el("span", { text: (m.emoji || "🙂") + " " + m.name + ": ⭐ " + w.stars + " из " + w.goal }), el("span", { class: "muted small", text: left ? "ещё " + left + (w.reward ? " до «" + w.reward + "»" : "") : "цель недели выполнена! 🎉" })),
            el("div", { class: "stars-track" }, el("div", { class: "stars-fill", style: "width:" + Math.min(100, (w.stars / w.goal) * 100) + "%" }))
          )
        );
      });
  }

  PD.family = {
    members,
    member,
    current,
    label,
    isKidMode,
    todayChores,
    weekStars,
    openMemberForm,
    openChoreForm,
    openPicker,
    renderTopbar,
    renderSettings,
    renderHome,
  };
})(window.PD);
