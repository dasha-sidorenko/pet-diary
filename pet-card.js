// Карточка питомца: кличка, вид, порода и дата рождения.
// Данные хранятся в localStorage отдельно от журнала.
const PET_STORAGE_KEY = "pet-diary-pet";

const petView = document.getElementById("pet-view");
const petName = document.getElementById("pet-name");
const petDetails = document.getElementById("pet-details");
const petForm = document.getElementById("pet-form");
const petEditButton = document.getElementById("pet-edit-button");
const petCancelButton = document.getElementById("pet-cancel-button");

let pet = loadPet();

function loadPet() {
  try {
    return JSON.parse(localStorage.getItem(PET_STORAGE_KEY));
  } catch {
    return null;
  }
}

function savePet() {
  try {
    localStorage.setItem(PET_STORAGE_KEY, JSON.stringify(pet));
  } catch {
    // Хранилище недоступно — карточка живёт до перезагрузки страницы
  }
}

// Склонение: 1 год, 2 года, 5 лет
function plural(number, one, few, many) {
  const mod10 = number % 10;
  const mod100 = number % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

// Возраст по дате рождения: «2 года 3 месяца», «5 месяцев» или «меньше месяца»
function formatAge(birthDate) {
  const birth = new Date(birthDate);
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) return null;
  if (months === 0) return "меньше месяца";

  const years = Math.floor(months / 12);
  const restMonths = months % 12;
  const parts = [];
  if (years > 0) parts.push(years + " " + plural(years, "год", "года", "лет"));
  if (restMonths > 0) parts.push(restMonths + " " + plural(restMonths, "месяц", "месяца", "месяцев"));
  return parts.join(" ");
}

function renderPet() {
  const hasPet = pet !== null;
  petView.hidden = !hasPet;
  petForm.hidden = hasPet;
  if (!hasPet) return;

  petName.textContent = pet.name;
  const details = [pet.species];
  if (pet.breed) details.push(pet.breed);
  if (pet.birthDate) {
    const age = formatAge(pet.birthDate);
    if (age) details.push(age);
  }
  petDetails.textContent = details.join(" · ");
}

function openForm() {
  petForm.elements.name.value = pet.name;
  petForm.elements.species.value = pet.species;
  petForm.elements.breed.value = pet.breed;
  petForm.elements.birthDate.value = pet.birthDate;
  petCancelButton.hidden = false;
  petView.hidden = true;
  petForm.hidden = false;
}

petForm.addEventListener("submit", function (event) {
  event.preventDefault();
  const name = petForm.elements.name.value.trim();
  if (!name) return;

  const birthDate = petForm.elements.birthDate.value;
  if (birthDate && new Date(birthDate) > new Date()) {
    alert("Дата рождения не может быть в будущем.");
    return;
  }

  pet = {
    name: name,
    species: petForm.elements.species.value,
    breed: petForm.elements.breed.value.trim(),
    birthDate: birthDate,
  };
  savePet();
  renderPet();
});

petEditButton.addEventListener("click", openForm);
petCancelButton.addEventListener("click", renderPet);

renderPet();
