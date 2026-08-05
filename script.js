"use strict";

const DEFAULT_MENUS = [
  "김치찌개",
  "제육볶음",
  "돈가스",
  "떡볶이",
  "햄버거",
  "초밥",
  "파스타",
  "치킨"
];

const PRESETS = {
  한식: ["김치찌개", "된장찌개", "제육볶음", "불고기", "비빔밥", "칼국수", "냉면", "삼겹살"],
  중식: ["짜장면", "짬뽕", "볶음밥", "탕수육", "마라탕", "양꼬치", "유린기", "마파두부"],
  일식: ["초밥", "돈가스", "라멘", "우동", "규동", "텐동", "오코노미야키", "소바"],
  양식: ["파스타", "피자", "스테이크", "리조또", "샐러드", "브런치", "라자냐", "필라프"],
  배달: ["치킨", "피자", "족발", "보쌈", "떡볶이", "햄버거", "찜닭", "마라탕"],
  야식: ["치킨", "족발", "곱창", "닭발", "라면", "피자", "떡볶이", "감자튀김"],
  간식: ["붕어빵", "타코야키", "핫도그", "와플", "아이스크림", "과일", "샌드위치", "토스트"]
};

const STORAGE_KEY = "menu-wheel-state-v2";
const LEGACY_STORAGE_KEY = "menu-wheel-items-v1";
const MAX_MENUS = 16;
const MAX_MENU_LENGTH = 16;
const SPIN_DURATION_MS = 4800;
const DRAW_MODES = new Set(["allow", "no-consecutive", "remove-win", "cycle"]);
const MODE_DESCRIPTIONS = {
  allow: "모든 메뉴를 동일한 확률로 추천합니다.",
  "no-consecutive": "직전에 나온 메뉴를 다음 한 번의 추첨에서 제외합니다.",
  "remove-win": "당첨된 메뉴를 목록에서 제거합니다. 메뉴가 2개면 제거하지 않습니다.",
  cycle: "모든 메뉴가 한 번씩 나온 뒤 추천 목록을 다시 채웁니다."
};
const COLORS = [
  "#f5b971",
  "#91c8a9",
  "#f18f8f",
  "#8eb5d9",
  "#c5a8df",
  "#f2d06b",
  "#8fd0ca",
  "#e5a4c2",
  "#b5c97c",
  "#d6a17e",
  "#e6bf97",
  "#a8c4ea"
];

const canvas = document.querySelector("#wheel");
const context = canvas.getContext("2d");
const spinButton = document.querySelector("#spinButton");
const spinAgainButton = document.querySelector("#spinAgainButton");
const excludeAndSpinButton = document.querySelector("#excludeAndSpinButton");
const copyResultButton = document.querySelector("#copyResultButton");
const mapSearchButton = document.querySelector("#mapSearchButton");
const deliverySearchButton = document.querySelector("#deliverySearchButton");
const resultBox = document.querySelector("#resultBox");
const resultText = document.querySelector("#resultText");
const cycleStatus = document.querySelector("#cycleStatus");
const menuForm = document.querySelector("#menuForm");
const menuInput = document.querySelector("#menuInput");
const menuMessage = document.querySelector("#menuMessage");
const menuList = document.querySelector("#menuList");
const menuCount = document.querySelector("#menuCount");
const resetButton = document.querySelector("#resetButton");
const drawMode = document.querySelector("#drawMode");
const drawModeDescription = document.querySelector("#drawModeDescription");
const presetButtons = document.querySelector("#presetButtons");
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

let { menus, mode } = loadState();
let currentRotation = 0;
let isSpinning = false;
let lastResult = null;
let cycleRemaining = [];
let editingIndex = null;
let draggedIndex = null;
let logicalCanvasSize = 640;
let spinFallbackTimer = null;
let activeTransitionHandler = null;
let activeSelectedMenu = null;

function normalizeMenuName(value) {
  return String(value).trim().replace(/\s+/g, " ");
}

function menuKey(value) {
  return normalizeMenuName(value).toLocaleLowerCase("ko-KR");
}

function sanitizeMenus(value) {
  if (!Array.isArray(value)) {
    return null;
  }

  const sanitized = [];
  const seen = new Set();

  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }

    const menu = normalizeMenuName(item).slice(0, MAX_MENU_LENGTH);
    const key = menuKey(menu);

    if (!menu || seen.has(key)) {
      continue;
    }

    sanitized.push(menu);
    seen.add(key);

    if (sanitized.length === MAX_MENUS) {
      break;
    }
  }

  return sanitized.length >= 2 ? sanitized : null;
}

function loadState() {
  try {
    const savedState = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const savedMenus = sanitizeMenus(savedState?.menus);
    const savedMode = DRAW_MODES.has(savedState?.mode) ? savedState.mode : "allow";

    if (savedMenus) {
      return { menus: savedMenus, mode: savedMode };
    }
  } catch (error) {
    console.warn("저장된 설정을 불러오지 못했습니다.", error);
  }

  try {
    const legacyMenus = sanitizeMenus(JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY)));

    if (legacyMenus) {
      return { menus: legacyMenus, mode: "allow" };
    }
  } catch (error) {
    console.warn("이전 메뉴 데이터를 불러오지 못했습니다.", error);
  }

  return { menus: [...DEFAULT_MENUS], mode: "allow" };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ menus, mode }));
    return true;
  } catch (error) {
    console.warn("메뉴 설정을 저장하지 못했습니다.", error);
    showMessage("브라우저 저장소를 사용할 수 없어 변경사항이 임시로만 유지됩니다.");
    return false;
  }
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const cssSize = Math.max(280, Math.round(rect.width || 640));
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const pixelSize = Math.round(cssSize * dpr);

  if (canvas.width !== pixelSize || canvas.height !== pixelSize) {
    canvas.width = pixelSize;
    canvas.height = pixelSize;
  }

  logicalCanvasSize = cssSize;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawWheel();
}

function drawWheel() {
  const size = logicalCanvasSize;
  const center = size / 2;
  const radius = size / 2 - Math.max(8, size * 0.025);
  const sliceAngle = (Math.PI * 2) / menus.length;

  context.clearRect(0, 0, size, size);

  menus.forEach((menu, index) => {
    const startAngle = index * sliceAngle - Math.PI / 2;
    const endAngle = startAngle + sliceAngle;
    const middleAngle = startAngle + sliceAngle / 2;

    context.beginPath();
    context.moveTo(center, center);
    context.arc(center, center, radius, startAngle, endAngle);
    context.closePath();
    context.fillStyle = COLORS[index % COLORS.length];
    context.fill();

    context.strokeStyle = "rgba(255, 255, 255, 0.8)";
    context.lineWidth = Math.max(2, size * 0.006);
    context.stroke();

    context.save();
    context.translate(center, center);
    context.rotate(middleAngle);
    context.textAlign = "right";
    context.textBaseline = "middle";
    context.fillStyle = "#20221f";
    context.font = `800 ${getFontSize(menu, menus.length, size)}px Pretendard, "Noto Sans KR", sans-serif`;
    context.fillText(shortenMenu(menu), radius - size * 0.07, 0);
    context.restore();
  });

  context.beginPath();
  context.arc(center, center, radius, 0, Math.PI * 2);
  context.strokeStyle = "rgba(32, 34, 31, 0.14)";
  context.lineWidth = Math.max(4, size * 0.012);
  context.stroke();
}

function getFontSize(menu, menuLength, size) {
  const scale = size / 640;
  const baseSize = menuLength >= 14 ? 20 : menuLength >= 11 ? 23 : menuLength >= 9 ? 26 : 30;
  const adjusted = menu.length >= 8 ? baseSize - 3 : baseSize;
  return Math.max(11, Math.round(adjusted * scale));
}

function shortenMenu(menu) {
  return menu.length > 10 ? `${menu.slice(0, 9)}…` : menu;
}

function renderPresets() {
  presetButtons.innerHTML = "";

  Object.keys(PRESETS).forEach((presetName) => {
    const button = document.createElement("button");
    button.className = "preset-button";
    button.type = "button";
    button.textContent = presetName;
    button.disabled = isSpinning || editingIndex !== null;
    button.addEventListener("click", () => applyPreset(presetName));
    presetButtons.append(button);
  });
}

function createIconButton(label, text, onClick, options = {}) {
  const button = document.createElement("button");
  button.className = `icon-button${options.delete ? " delete" : ""}`;
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.textContent = text;
  button.disabled = Boolean(options.disabled);
  button.addEventListener("click", onClick);
  return button;
}

function renderMenuList() {
  menuList.innerHTML = "";
  menuCount.textContent = String(menus.length);

  menus.forEach((menu, index) => {
    const item = document.createElement("li");
    item.className = "menu-item";
    item.dataset.index = String(index);

    if (editingIndex === index) {
      item.append(createEditRow(index, menu));
      menuList.append(item);
      return;
    }

    const canInteract = !isSpinning && editingIndex === null;
    item.draggable = canInteract;
    item.tabIndex = canInteract ? 0 : -1;
    item.setAttribute("aria-label", `${menu}, ${index + 1}번째 메뉴. 드래그하여 순서 변경 가능`);

    const handle = document.createElement("span");
    handle.className = "drag-handle";
    handle.setAttribute("aria-hidden", "true");
    handle.textContent = "⠿";

    const name = document.createElement("span");
    name.className = "menu-name";
    name.textContent = menu;
    name.title = menu;

    const actions = document.createElement("div");
    actions.className = "menu-actions";
    actions.append(
      createIconButton(`${menu} 위로 이동`, "↑", () => moveMenu(index, -1), {
        disabled: !canInteract || index === 0
      }),
      createIconButton(`${menu} 아래로 이동`, "↓", () => moveMenu(index, 1), {
        disabled: !canInteract || index === menus.length - 1
      }),
      createIconButton(`${menu} 수정`, "✎", () => startEditing(index), {
        disabled: !canInteract
      }),
      createIconButton(`${menu} 삭제`, "×", () => deleteMenu(index), {
        delete: true,
        disabled: !canInteract || menus.length <= 2
      })
    );

    item.append(handle, name, actions);
    attachDragEvents(item, index);
    menuList.append(item);
  });

  updateControls();
}

function createEditRow(index, menu) {
  const form = document.createElement("form");
  form.className = "edit-row";

  const input = document.createElement("input");
  input.className = "edit-input";
  input.type = "text";
  input.maxLength = MAX_MENU_LENGTH;
  input.value = menu;
  input.setAttribute("aria-label", `${menu} 이름 수정`);

  const saveButton = document.createElement("button");
  saveButton.className = "edit-action save";
  saveButton.type = "submit";
  saveButton.textContent = "저장";

  const cancelButton = document.createElement("button");
  cancelButton.className = "edit-action cancel";
  cancelButton.type = "button";
  cancelButton.textContent = "취소";
  cancelButton.addEventListener("click", cancelEditing);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    updateMenu(index, input.value);
  });

  form.append(input, saveButton, cancelButton);
  window.requestAnimationFrame(() => {
    input.focus();
    input.select();
  });

  return form;
}

function attachDragEvents(item, index) {
  item.addEventListener("dragstart", (event) => {
    if (isSpinning || editingIndex !== null) {
      event.preventDefault();
      return;
    }

    draggedIndex = index;
    item.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  });

  item.addEventListener("dragover", (event) => {
    if (draggedIndex === null || draggedIndex === index) {
      return;
    }

    event.preventDefault();
    item.classList.add("is-drag-target");
    event.dataTransfer.dropEffect = "move";
  });

  item.addEventListener("dragleave", () => {
    item.classList.remove("is-drag-target");
  });

  item.addEventListener("drop", (event) => {
    event.preventDefault();
    item.classList.remove("is-drag-target");

    const fromIndex = Number(event.dataTransfer.getData("text/plain"));
    if (Number.isInteger(fromIndex)) {
      reorderMenu(fromIndex, index);
    }
  });

  item.addEventListener("dragend", () => {
    draggedIndex = null;
    document.querySelectorAll(".menu-item").forEach((menuItem) => {
      menuItem.classList.remove("is-dragging", "is-drag-target");
    });
  });
}

function updateControls() {
  const unavailable = isSpinning || editingIndex !== null;
  const hasResult = Boolean(lastResult);

  spinButton.disabled = unavailable || menus.length < 2;
  spinButton.textContent = isSpinning ? "돌아가는 중..." : "돌리기";
  spinButton.setAttribute("aria-busy", String(isSpinning));

  menuInput.disabled = unavailable;
  menuForm.querySelector("button").disabled = unavailable || menus.length >= MAX_MENUS;
  resetButton.disabled = unavailable;
  drawMode.disabled = unavailable;
  drawMode.value = mode;
  drawModeDescription.textContent = MODE_DESCRIPTIONS[mode];

  spinAgainButton.disabled = unavailable || !hasResult;
  excludeAndSpinButton.disabled = unavailable || !hasResult || menus.length < 2;
  copyResultButton.disabled = unavailable || !hasResult;
  mapSearchButton.disabled = unavailable || !hasResult;
  deliverySearchButton.disabled = unavailable || !hasResult;

  renderPresets();
  renderCycleStatus();
}

function renderCycleStatus() {
  if (mode !== "cycle") {
    cycleStatus.hidden = true;
    cycleStatus.textContent = "";
    return;
  }

  const remainingCount = cycleRemaining.filter((menu) => menus.some((item) => menuKey(item) === menuKey(menu))).length;
  cycleStatus.hidden = false;
  cycleStatus.textContent = remainingCount === 0
    ? `다음 회차 ${menus.length}개 준비`
    : `이번 회차 ${remainingCount}/${menus.length}개 남음`;
}

function resetSelectionState({ clearLastResult = true } = {}) {
  cycleRemaining = [];

  if (clearLastResult) {
    lastResult = null;
    clearResult();
  }
}

function commitMenuChange(successMessage = "") {
  saveState();
  resetSelectionState();
  editingIndex = null;
  resizeCanvas();
  renderMenuList();

  if (successMessage) {
    showMessage(successMessage, true);
  }
}

function deleteMenu(index) {
  if (isSpinning || menus.length <= 2 || !menus[index]) {
    return;
  }

  const [deleted] = menus.splice(index, 1);
  commitMenuChange(`${deleted} 메뉴를 삭제했습니다.`);
}

function addMenu(rawValue) {
  if (isSpinning) {
    return;
  }

  const newMenu = normalizeMenuName(rawValue);

  if (!newMenu) {
    showMessage("메뉴 이름을 입력해주세요.");
    return;
  }

  if (newMenu.length > MAX_MENU_LENGTH) {
    showMessage(`메뉴 이름은 ${MAX_MENU_LENGTH}자 이하로 입력해주세요.`);
    return;
  }

  if (menus.some((menu) => menuKey(menu) === menuKey(newMenu))) {
    showMessage("이미 등록된 메뉴입니다.");
    return;
  }

  if (menus.length >= MAX_MENUS) {
    showMessage(`메뉴는 최대 ${MAX_MENUS}개까지 등록할 수 있습니다.`);
    return;
  }

  menus.push(newMenu);
  menuInput.value = "";
  commitMenuChange(`${newMenu} 메뉴를 추가했습니다.`);
  menuInput.focus();
}

function startEditing(index) {
  if (isSpinning || !menus[index]) {
    return;
  }

  editingIndex = index;
  showMessage("");
  renderMenuList();
}

function cancelEditing() {
  editingIndex = null;
  renderMenuList();
}

function updateMenu(index, rawValue) {
  const updatedMenu = normalizeMenuName(rawValue);

  if (!updatedMenu) {
    showMessage("수정할 메뉴 이름을 입력해주세요.");
    return;
  }

  if (updatedMenu.length > MAX_MENU_LENGTH) {
    showMessage(`메뉴 이름은 ${MAX_MENU_LENGTH}자 이하로 입력해주세요.`);
    return;
  }

  if (menus.some((menu, menuIndex) => menuIndex !== index && menuKey(menu) === menuKey(updatedMenu))) {
    showMessage("이미 등록된 메뉴입니다.");
    return;
  }

  const previousMenu = menus[index];
  menus[index] = updatedMenu;
  commitMenuChange(`${previousMenu}을(를) ${updatedMenu}(으)로 수정했습니다.`);
}

function moveMenu(index, direction) {
  const targetIndex = index + direction;

  if (
    isSpinning ||
    editingIndex !== null ||
    targetIndex < 0 ||
    targetIndex >= menus.length
  ) {
    return;
  }

  [menus[index], menus[targetIndex]] = [menus[targetIndex], menus[index]];
  commitMenuChange("메뉴 순서를 변경했습니다.");
}

function reorderMenu(fromIndex, toIndex) {
  if (
    isSpinning ||
    editingIndex !== null ||
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= menus.length ||
    toIndex >= menus.length
  ) {
    return;
  }

  const [movedMenu] = menus.splice(fromIndex, 1);
  menus.splice(toIndex, 0, movedMenu);
  commitMenuChange("드래그로 메뉴 순서를 변경했습니다.");
}

function applyPreset(presetName) {
  if (isSpinning || editingIndex !== null || !PRESETS[presetName]) {
    return;
  }

  menus = [...PRESETS[presetName]];
  commitMenuChange(`${presetName} 프리셋을 적용했습니다.`);
}

function getEligibleMenus(excludedMenu = null) {
  let eligible = [...menus];

  if (mode === "cycle") {
    cycleRemaining = cycleRemaining.filter((remainingMenu) =>
      menus.some((menu) => menuKey(menu) === menuKey(remainingMenu))
    );

    if (cycleRemaining.length === 0) {
      cycleRemaining = [...menus];
    }

    eligible = [...cycleRemaining];
  } else if (mode === "no-consecutive" && lastResult && menus.length > 1) {
    eligible = menus.filter((menu) => menuKey(menu) !== menuKey(lastResult));
  }

  if (excludedMenu && eligible.length > 1) {
    const filtered = eligible.filter((menu) => menuKey(menu) !== menuKey(excludedMenu));
    if (filtered.length > 0) {
      eligible = filtered;
    }
  }

  return eligible;
}

function spinWheel(options = {}) {
  if (isSpinning || editingIndex !== null || menus.length < 2) {
    return;
  }

  const eligibleMenus = getEligibleMenus(options.exclude || null);
  const selectedMenu = eligibleMenus[Math.floor(Math.random() * eligibleMenus.length)];
  const selectedIndex = menus.findIndex((menu) => menuKey(menu) === menuKey(selectedMenu));

  if (selectedIndex < 0) {
    showMessage("추천할 메뉴를 찾지 못했습니다.");
    return;
  }

  isSpinning = true;
  activeSelectedMenu = selectedMenu;
  showMessage("");
  resultText.textContent = "메뉴를 고르는 중...";
  resultBox.classList.remove("is-highlighted");
  updateControls();
  renderMenuList();

  const sliceDegrees = 360 / menus.length;
  const selectedCenter = selectedIndex * sliceDegrees + sliceDegrees / 2;
  const normalizedRotation = normalizeDegrees(currentRotation);
  const targetNormalized = normalizeDegrees(360 - selectedCenter);
  const adjustment = normalizeDegrees(targetNormalized - normalizedRotation);
  const extraSpins = 5 + Math.floor(Math.random() * 3);

  currentRotation += extraSpins * 360 + adjustment;
  canvas.style.transition = reducedMotionQuery.matches
    ? "none"
    : `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.12, 0.78, 0.16, 1)`;

  window.requestAnimationFrame(() => {
    canvas.style.transform = `rotate(${currentRotation}deg)`;
  });

  const complete = () => finishSpin(selectedMenu);

  if (reducedMotionQuery.matches) {
    window.requestAnimationFrame(complete);
    return;
  }

  activeTransitionHandler = (event) => {
    if (event.propertyName !== "transform") {
      return;
    }

    cleanupSpinWait();
    complete();
  };

  canvas.addEventListener("transitionend", activeTransitionHandler);
  spinFallbackTimer = window.setTimeout(() => {
    cleanupSpinWait();
    complete();
  }, SPIN_DURATION_MS + 700);
}

function cleanupSpinWait() {
  if (activeTransitionHandler) {
    canvas.removeEventListener("transitionend", activeTransitionHandler);
    activeTransitionHandler = null;
  }

  if (spinFallbackTimer) {
    window.clearTimeout(spinFallbackTimer);
    spinFallbackTimer = null;
  }
}

function finishSpin(selectedMenu) {
  if (!isSpinning) {
    return;
  }

  cleanupSpinWait();
  isSpinning = false;
  activeSelectedMenu = null;
  normalizeCanvasRotation();
  lastResult = selectedMenu;

  if (mode === "cycle") {
    cycleRemaining = cycleRemaining.filter((menu) => menuKey(menu) !== menuKey(selectedMenu));
  }

  resultText.textContent = selectedMenu;
  resultBox.classList.remove("is-highlighted");
  void resultBox.offsetWidth;
  resultBox.classList.add("is-highlighted");

  if (mode === "remove-win" && menus.length > 2) {
    menus = menus.filter((menu) => menuKey(menu) !== menuKey(selectedMenu));
    saveState();
    resizeCanvas();
    showMessage(`${selectedMenu} 메뉴가 당첨되어 목록에서 제거되었습니다.`, true);
  } else if (mode === "remove-win" && menus.length <= 2) {
    showMessage("메뉴를 최소 2개 유지하기 위해 당첨 메뉴를 제거하지 않았습니다.");
  }

  renderMenuList();
}

function normalizeCanvasRotation() {
  currentRotation = normalizeDegrees(currentRotation);
  canvas.style.transition = "none";
  canvas.style.transform = `rotate(${currentRotation}deg)`;
  void canvas.offsetWidth;
}

function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}

function resetMenus() {
  if (isSpinning || editingIndex !== null) {
    return;
  }

  menus = [...DEFAULT_MENUS];
  mode = "allow";
  drawMode.value = mode;
  currentRotation = 0;
  canvas.style.transition = "none";
  canvas.style.transform = "rotate(0deg)";
  resetSelectionState();
  saveState();
  showMessage("기본 메뉴와 당첨 방식을 복원했습니다.", true);
  resizeCanvas();
  renderMenuList();
}

function clearResult() {
  resultText.textContent = "돌림판을 돌려보세요";
  resultBox.classList.remove("is-highlighted");
  updateControls();
}

function showMessage(message, isSuccess = false) {
  menuMessage.textContent = message;
  menuMessage.classList.toggle("is-success", Boolean(message) && isSuccess);
}

async function copyResult() {
  if (!lastResult) {
    return;
  }

  try {
    await navigator.clipboard.writeText(lastResult);
  } catch (error) {
    const textarea = document.createElement("textarea");
    textarea.value = lastResult;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  showMessage(`${lastResult} 결과를 복사했습니다.`, true);
}

function openSearch(type) {
  if (!lastResult) {
    return;
  }

  const url = type === "map"
    ? `https://map.naver.com/p/search/${encodeURIComponent(lastResult)}`
    : `https://search.naver.com/search.naver?query=${encodeURIComponent(`${lastResult} 배달`)}`;

  window.open(url, "_blank", "noopener,noreferrer");
}

function handleModeChange() {
  const selectedMode = drawMode.value;

  if (!DRAW_MODES.has(selectedMode)) {
    return;
  }

  mode = selectedMode;
  cycleRemaining = [];
  saveState();
  showMessage("당첨 방식을 변경했습니다.", true);
  updateControls();
}

function initialize() {
  drawMode.value = mode;
  renderPresets();
  renderMenuList();
  resizeCanvas();
  clearResult();
}

menuForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addMenu(menuInput.value);
});

spinButton.addEventListener("click", () => spinWheel());
spinAgainButton.addEventListener("click", () => spinWheel());
excludeAndSpinButton.addEventListener("click", () => spinWheel({ exclude: lastResult }));
copyResultButton.addEventListener("click", copyResult);
mapSearchButton.addEventListener("click", () => openSearch("map"));
deliverySearchButton.addEventListener("click", () => openSearch("delivery"));
resetButton.addEventListener("click", resetMenus);
drawMode.addEventListener("change", handleModeChange);

window.addEventListener("resize", resizeCanvas);

if ("ResizeObserver" in window) {
  const canvasObserver = new ResizeObserver(() => resizeCanvas());
  canvasObserver.observe(canvas);
}

reducedMotionQuery.addEventListener?.("change", () => {
  if (isSpinning && reducedMotionQuery.matches && activeSelectedMenu) {
    canvas.style.transition = "none";
    window.requestAnimationFrame(() => finishSpin(activeSelectedMenu));
  }
});

initialize();
