const feedButton = document.getElementById("feed-button");
const journal = document.getElementById("journal");

feedButton.addEventListener("click", function() {
    const now = new Date();

    const time = now.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit"
    });

    const newItem = document.createElement("li");
    newItem.textContent = "Покормил в " + time;

    journal.appendChild(newItem);
});
