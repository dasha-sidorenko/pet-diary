const journal = document.getElementById("journal");
const emptyMessage = document.getElementById("empty-message");
const clearButton = document.getElementById("clear-button");
const STORAGE_KEY = "pet-diary-entries";

// Загружаем записи, сохранённые в браузере (чтобы не пропадали после перезагрузки)
let entries = loadEntries();

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveEntries() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Хранилище недоступно (например, приватный режим) — просто работаем без сохранения
  }
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const time = date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const isToday = date.toDateString() === new Date().toDateString();
  if (isToday) return "сегодня в " + time;
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) + " в " + time;
}

// Перерисовываем весь список: новые записи сверху
function render() {
  journal.innerHTML = "";

  entries.forEach(function (entry, index) {
    const item = document.createElement("li");

    const text = document.createElement("span");
    text.textContent = entry.action + " " + formatTime(entry.time);

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "✕";
    deleteButton.className = "delete";
    deleteButton.title = "Удалить запись";
    deleteButton.addEventListener("click", function () {
      entries.splice(index, 1);
      saveEntries();
      render();
    });

    item.append(text, deleteButton);
    journal.appendChild(item);
  });

  emptyMessage.hidden = entries.length > 0;
  clearButton.hidden = entries.length === 0;
}

function addEntry(action) {
  entries.unshift({ action: action, time: Date.now() });
  saveEntries();
  render();
}

// Одна функция для всех кнопок: текст действия берётся из атрибута data-action.
// Чтобы добавить новое действие, достаточно добавить кнопку в index.html.
document.querySelectorAll("[data-action]").forEach(function (button) {
  button.addEventListener("click", function () {
    addEntry(button.dataset.action);
  });
});

clearButton.addEventListener("click", function () {
  if (confirm("Удалить все записи?")) {
    entries = [];
    saveEntries();
    render();
  }
});

render();
