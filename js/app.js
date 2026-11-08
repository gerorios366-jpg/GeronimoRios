const STORAGE_KEY = "orbita-bitacora-misiones-v2";
const cardDialog = document.querySelector("#card-dialog");
const cardForm = document.querySelector("#card-form");
const cardGrid = document.querySelector(".card-grid");
const missionCount = document.querySelector("#mission-count");
const feedback = document.querySelector("#form-feedback");
const formTitle = document.querySelector("#form-title");
const saveCardButton = document.querySelector("#save-card-button");

let missions = [];
let templateMissions = [];
let templateMissionIds = new Set();
let savedState = null;
let editingMissionId = null;

function updateMissionCount() {
  missionCount.textContent = String(missions.length).padStart(2, "0");
}

function makeActionButton(action, title, icon, label) {
  const button = document.createElement("button");
  button.className = `card-action card-action--${action}`;
  button.type = "button";
  button.dataset.action = action;
  button.setAttribute("aria-label", `${label} tarjeta de ${title}`);
  button.append(document.createTextNode(label));

  const symbol = document.createElement("span");
  symbol.setAttribute("aria-hidden", "true");
  symbol.textContent = icon;
  button.append(symbol);
  return button;
}

function createMissionCard(mission) {
  const item = document.createElement("div");
  item.className = "mission-item";
  item.dataset.missionId = mission.id;

  const card = document.createElement("article");
  card.className = `mission-card ${mission.cardClass}`;

  const top = document.createElement("div");
  top.className = "mission-card__top";

  const symbol = document.createElement("span");
  symbol.className = "mission-card__symbol";
  symbol.setAttribute("aria-hidden", "true");
  symbol.textContent = mission.symbol;

  const tag = document.createElement("span");
  tag.className = `tag ${mission.statusClass}`;
  tag.textContent = mission.status;
  top.append(symbol, tag);

  const actions = document.createElement("div");
  actions.className = "card-actions";
  actions.append(
    makeActionButton("edit", mission.title, "✎", "Editar"),
    makeActionButton("delete", mission.title, "×", "Eliminar"),
  );

  const missionId = document.createElement("p");
  missionId.className = "mission-card__id";
  missionId.textContent = `MISIÓN ${String(mission.number).padStart(3, "0")}`;

  const heading = document.createElement("h3");
  heading.textContent = mission.title;

  const summary = document.createElement("p");
  summary.className = "mission-card__description";
  summary.textContent = mission.description;

  const data = document.createElement("dl");
  data.className = "mission-card__data";
  for (const metric of mission.metrics) {
    const metricItem = document.createElement("div");
    const label = document.createElement("dt");
    label.textContent = metric.label;
    const value = document.createElement("dd");
    value.append(document.createTextNode(`${Number(metric.value).toLocaleString("es-CO", {
      maximumFractionDigits: 2,
      useGrouping: Boolean(metric.unit),
    })} `));
    const unit = document.createElement("span");
    unit.textContent = metric.unit;
    value.append(unit);
    metricItem.append(label, value);
    data.append(metricItem);
  }

  card.append(top, actions, missionId, heading, summary, data);
  item.append(card);
  return item;
}

function renderMissions() {
  const fragment = document.createDocumentFragment();
  for (const mission of missions) {
    fragment.append(createMissionCard(mission));
  }
  cardGrid.replaceChildren(fragment);
  updateMissionCount();
}

function persistState(updatedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedState));
  } catch (error) {
    console.error("No se pudieron guardar las misiones en este navegador:", error);
    feedback.textContent = "No se pudieron guardar los cambios. Revisa el almacenamiento disponible del navegador e inténtalo de nuevo.";
    return false;
  }

  savedState = updatedState;
  missions = getVisibleMissions();
  renderMissions();
  return true;
}

function getVisibleMissions() {
  const deletedIds = new Set(savedState.deletedIds);
  const template = templateMissions
    .filter((mission) => !deletedIds.has(mission.id))
    .map((mission) => savedState.overrides[mission.id] ?? mission);
  return [...template, ...savedState.customMissions];
}

function getMetricFromElement(element) {
  const label = element.querySelector("dt")?.textContent.trim();
  const valueElement = element.querySelector("dd");
  const unit = valueElement?.querySelector("span")?.textContent.trim() ?? "";
  const valueText = valueElement?.childNodes
    ? [...valueElement.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent)
      .join("")
      .trim()
      .replace(",", ".")
    : "";
  const value = Number(valueText);

  if (!label || !Number.isFinite(value)) {
    throw new Error("Cada dato de una tarjeta debe incluir una etiqueta y un número válido.");
  }

  return { label, value, unit };
}

function parseInitialCards(markup) {
  const parsedDocument = new DOMParser().parseFromString(markup, "text/html");
  const cards = [...parsedDocument.querySelectorAll(".mission-card")];
  if (cards.length === 0) {
    throw new Error("cards/Planeta.html no contiene tarjetas .mission-card.");
  }

  const ids = new Set();
  const missionsFromFile = cards.map((card, index) => {
    const metrics = [...card.querySelectorAll(".mission-card__data > div")]
      .map(getMetricFromElement);
    const title = card.querySelector("h3")?.textContent.trim();
    const description = card.querySelector(".mission-card__description")?.textContent.trim();
    if (!title || !description || metrics.length === 0) {
      throw new Error("Una tarjeta de cards/Planeta.html no tiene todos sus datos.");
    }

    const id = card.dataset.missionId || `mission-${index + 1}`;
    if (ids.has(id)) {
      throw new Error(`El identificador "${id}" está repetido en cards/Planeta.html.`);
    }
    ids.add(id);

    const idText = card.querySelector(".mission-card__id")?.textContent.trim() || "";
    const number = Number(idText.match(/\d+/)?.[0]) || index + 1;
    return {
      id,
      number,
      title,
      description,
      symbol: card.querySelector(".mission-card__symbol")?.textContent.trim() || "✦",
      status: card.querySelector(".tag")?.textContent.trim() || "OBJETIVO",
      statusClass: card.querySelector(".tag")?.classList.contains("tag--planned") ? "tag--planned" : "",
      cardClass: [...card.classList].find((className) => className.startsWith("mission-card--")) || "mission-card--custom",
      metrics,
    };
  });

  return missionsFromFile;
}

function isMission(mission) {
  return mission
    && typeof mission.id === "string"
    && Number.isInteger(mission.number)
    && typeof mission.title === "string"
    && typeof mission.description === "string"
    && typeof mission.symbol === "string"
    && typeof mission.status === "string"
    && typeof mission.statusClass === "string"
    && typeof mission.cardClass === "string"
    && Array.isArray(mission.metrics)
    && mission.metrics.length > 0
    && mission.metrics.every((metric) => (
      typeof metric.label === "string"
      && Number.isFinite(metric.value)
      && typeof metric.unit === "string"
    ));
}

function isSavedState(value) {
  return value
    && Array.isArray(value.deletedIds)
    && value.deletedIds.every((id) => typeof id === "string")
    && value.overrides
    && typeof value.overrides === "object"
    && !Array.isArray(value.overrides)
    && Object.values(value.overrides).every(isMission)
    && Array.isArray(value.customMissions)
    && value.customMissions.every(isMission)
    && Number.isInteger(value.nextMissionNumber)
    && value.nextMissionNumber > 0;
}

async function loadInitialCards() {
  try {
    const response = await fetch("cards/Planeta.html");
    if (!response.ok) {
      throw new Error(`No se pudo cargar cards/Planeta.html: ${response.status}`);
    }

    templateMissions = parseInitialCards(await response.text());
    templateMissionIds = new Set(templateMissions.map((mission) => mission.id));
    const storedState = localStorage.getItem(STORAGE_KEY);
    if (storedState !== null) {
      const parsedState = JSON.parse(storedState);
      if (!isSavedState(parsedState)) {
        throw new Error("Los datos guardados de las tarjetas no tienen un formato válido.");
      }

      savedState = parsedState;
      const lastTemplateNumber = Math.max(0, ...templateMissions.map((mission) => mission.number));
      savedState.nextMissionNumber = Math.max(savedState.nextMissionNumber, lastTemplateNumber + 1);
    } else {
      const lastMissionNumber = Math.max(0, ...templateMissions.map((mission) => mission.number));
      savedState = {
        deletedIds: [],
        overrides: {},
        customMissions: [],
        nextMissionNumber: lastMissionNumber + 1,
      };
    }

    missions = getVisibleMissions();
    renderMissions();
    if (storedState === null) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedState));
      } catch (error) {
        console.error("No se pudo inicializar el almacenamiento de misiones:", error);
        feedback.textContent = "Las tarjetas se cargaron, pero el navegador no pudo guardar los cambios.";
        return;
      }
    }
    feedback.textContent = "Los cambios se guardan en este navegador y se mantienen al recargar la página.";
  } catch (error) {
    console.error("Error al cargar las tarjetas guardadas:", error);
    feedback.textContent = "No se pudieron cargar las tarjetas. Usa Live Server y verifica el almacenamiento local del navegador.";
  }
}

function openForm(mission = null) {
  editingMissionId = mission?.id ?? null;
  cardForm.reset();
  formTitle.textContent = mission ? "Editar misión" : "Agregar misión";
  saveCardButton.textContent = mission ? "Guardar cambios" : "Guardar tarjeta";

  if (mission) {
    cardForm.elements.title.value = mission.title;
    cardForm.elements.description.value = mission.description;
    cardForm.elements.measure.value = mission.metrics[0].label;
    cardForm.elements.value.value = mission.metrics[0].value;
    cardForm.elements.unit.value = mission.metrics[0].unit;
  }

  cardDialog.showModal();
  cardForm.elements.title.focus();
}

document.querySelector("#open-card-form").addEventListener("click", () => openForm());

document.querySelector("#close-card-form").addEventListener("click", () => cardDialog.close());
document.querySelector("#cancel-card-form").addEventListener("click", () => cardDialog.close());

cardDialog.addEventListener("close", () => {
  editingMissionId = null;
  cardForm.reset();
});

cardDialog.addEventListener("click", (event) => {
  if (event.target === cardDialog) {
    cardDialog.close();
  }
});

cardForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(cardForm);
  const details = {
    title: formData.get("title").trim(),
    description: formData.get("description").trim(),
    metric: {
      label: formData.get("measure").trim(),
      value: Number(formData.get("value")),
      unit: formData.get("unit").trim(),
    },
  };

  let updatedState;
  if (editingMissionId) {
    const existingMission = missions.find((mission) => mission.id === editingMissionId);
    const updatedMission = {
      ...existingMission,
      title: details.title,
      description: details.description,
      metrics: [details.metric, ...existingMission.metrics.slice(1)],
    };

    if (templateMissionIds.has(editingMissionId)) {
      updatedState = {
        ...savedState,
        overrides: { ...savedState.overrides, [editingMissionId]: updatedMission },
      };
    } else {
      updatedState = {
        ...savedState,
        customMissions: savedState.customMissions.map((mission) => (
          mission.id === editingMissionId ? updatedMission : mission
        )),
      };
    }
  } else {
    const number = savedState.nextMissionNumber;
    const newMission = {
      id: `custom-${number}`,
      number,
      title: details.title,
      description: details.description,
      symbol: "✦",
      status: "NUEVA MISIÓN",
      statusClass: "tag--planned",
      cardClass: "mission-card--custom",
      metrics: [details.metric],
    };
    updatedState = {
      ...savedState,
      customMissions: [...savedState.customMissions, newMission],
      nextMissionNumber: number + 1,
    };
  }

  const wasEditing = Boolean(editingMissionId);
  if (persistState(updatedState)) {
    cardDialog.close();
    feedback.textContent = wasEditing
      ? `La tarjeta de ${details.title} se actualizó y quedó guardada.`
      : `La tarjeta de ${details.title} se agregó y quedó guardada.`;
  }
});

cardGrid.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) {
    return;
  }

  const item = actionButton.closest(".mission-item");
  const mission = missions.find((entry) => entry.id === item.dataset.missionId);
  if (!mission) {
    feedback.textContent = "No se encontró la tarjeta seleccionada. Recarga la página e inténtalo de nuevo.";
    return;
  }

  if (actionButton.dataset.action === "edit") {
    openForm(mission);
    return;
  }

  const updatedState = templateMissionIds.has(mission.id)
    ? {
      ...savedState,
      deletedIds: [...new Set([...savedState.deletedIds, mission.id])],
      overrides: Object.fromEntries(
        Object.entries(savedState.overrides).filter(([id]) => id !== mission.id),
      ),
    }
    : {
      ...savedState,
      customMissions: savedState.customMissions.filter((entry) => entry.id !== mission.id),
    };
  if (persistState(updatedState)) {
    feedback.textContent = `La tarjeta de ${mission.title} se eliminó y no volverá a aparecer al recargar.`;
  }
});

loadInitialCards();
