import "./style.css";

import { findBestSplit, greedyWrap, diagnoseFailure } from "./centring.js";

const DEFAULT_PAGE_WIDTH = 100;
const DEFAULT_MAX_TITLE_WIDTH = 20;

// Columns drawn either side of the page, so a space count fits left of a line
// that starts at the page edge
const GUTTER_CHARS = 4;

document.addEventListener("DOMContentLoaded", () => {
  const pageWidth = document.getElementById("pageWidth");
  const pageTitle = document.getElementById("pageTitle");
  const maxTitleWidth = document.getElementById("maxTitleWidth");
  const cannotBeCentred = document.getElementById("cannotBeCentred");
  const maxTitleWidthHint = maxTitleWidth.nextElementSibling;
  const canvas = document.getElementById("paperMockup");
  const ctx = canvas.getContext("2d");

  // Drawing size; the canvas pixels are scaled up by the device pixel ratio
  const canvasWidth = 800;
  const canvasHeight = 400;

  let lineX = canvasWidth / 2;
  let isDragging = false;
  let centredLines = [];
  let cannotBeCentredTimeout = null;
  let currentPixelRatio = 0;

  function getPageWidth() {
    return Math.max(1, parseFloat(pageWidth.value) || DEFAULT_PAGE_WIDTH);
  }

  function getMaxTitleWidth() {
    return Math.max(1, Math.min(parseFloat(maxTitleWidth.value) || DEFAULT_MAX_TITLE_WIDTH, getPageWidth()));
  }

  // Width of one character on the canvas
  function getCharWidth() {
    return canvasWidth / (getPageWidth() + 2 * GUTTER_CHARS);
  }

  // Match the canvas resolution to the screen so the text stays sharp.
  // Returns true if the resolution changed.
  function matchDevicePixelRatio() {
    const ratio = window.devicePixelRatio || 1;
    if (ratio === currentPixelRatio) return false;
    currentPixelRatio = ratio;

    canvas.width = Math.round(canvasWidth * ratio);
    canvas.height = Math.round(canvasHeight * ratio);
    ctx.setTransform(canvas.width / canvasWidth, 0, 0, canvas.height / canvasHeight, 0, 0);
    return true;
  }

  // Get the saved values from local storage
  function restoreSavedInputs() {
    pageWidth.value = localStorage.getItem("pageWidth") ?? DEFAULT_PAGE_WIDTH;
    pageTitle.value = localStorage.getItem("pageTitle") ?? "";
    maxTitleWidth.value = localStorage.getItem("maxTitleWidth") ?? DEFAULT_MAX_TITLE_WIDTH;

    restrictMaxTitleWidth();
    positionLineFromInputs();
    renderPageLayout();
  }

  // Calculate the spacing required for the title
  function renderPageLayout() {
    const pageWidthValue = getPageWidth();
    const maxTitleWidthValue = getMaxTitleWidth();
    const title = pageTitle.value;

    const lines = findBestSplit(title, pageWidthValue, maxTitleWidthValue);

    clearTimeout(cannotBeCentredTimeout);

    if (lines === null) {
      cannotBeCentredTimeout = setTimeout(() => {
        showCannotBeCentred(diagnoseFailure(title, pageWidthValue, maxTitleWidthValue));
      }, 500);
    } else {
      cannotBeCentred.style.visibility = "hidden";
    }

    const displayLines = lines ?? greedyWrap(title, maxTitleWidthValue);

    centredLines = displayLines.map((line) => ({
      line,
      spacesNeeded: (pageWidthValue - line.length) / 2,
    }));

    drawCanvasContent();
  }

  // Show why the title can't be centred, with a link to the nearest max title
  // width that works (if there is one)
  function showCannotBeCentred(diagnosis) {
    if (!diagnosis) return;

    cannotBeCentred.replaceChildren(diagnosis.message);

    const suggested = diagnosis.suggestedMaxTitleWidth;
    if (suggested !== null) {
      const suggestion = document.createElement("button");
      suggestion.type = "button";
      suggestion.className = "link";
      suggestion.title = `Set max title width to ${suggested}`;
      suggestion.textContent = `try ${suggested}`;
      suggestion.addEventListener("click", () => setMaxTitleWidth(suggested));
      cannotBeCentred.append(", ", suggestion);
    }

    cannotBeCentred.style.visibility = "visible";
  }

  // draw the text and line on the canvas (after clearing)
  function drawCanvasContent() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const charWidth = getCharWidth();
    const pageLeft = GUTTER_CHARS * charWidth;
    const pageRight = canvasWidth - pageLeft;

    // Size the font so each character is exactly one column wide
    ctx.font = "100px IBM, monospace";
    const fontSize = (100 * charWidth) / ctx.measureText("0").width;
    ctx.font = `${fontSize}px IBM, monospace`;
    ctx.textBaseline = "top";

    // Page edges
    ctx.beginPath();
    ctx.moveTo(pageLeft, 0);
    ctx.lineTo(pageLeft, canvasHeight);
    ctx.moveTo(pageRight, 0);
    ctx.lineTo(pageRight, canvasHeight);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#e5e7eb";
    ctx.stroke();

    const lineHeight = fontSize * 1.2;
    const startY = (canvasHeight - centredLines.length * lineHeight) / 2;

    centredLines.forEach(({ line, spacesNeeded }, index) => {
      const y = startY + index * lineHeight;
      const lineStart = pageLeft + spacesNeeded * charWidth;

      // Space count just left of the line, in red if it isn't a whole number
      ctx.textAlign = "right";
      ctx.fillStyle = Number.isInteger(spacesNeeded) ? "black" : "red";
      ctx.fillText(`${spacesNeeded}`, lineStart - charWidth, y);

      // The line itself, where it will sit on the page
      ctx.textAlign = "left";
      ctx.fillStyle = "gray";
      ctx.fillText(line, lineStart, y);
    });

    ctx.beginPath();
    ctx.moveTo(lineX, 0);
    ctx.lineTo(lineX, canvasHeight);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "black";
    ctx.stroke();

    const arrowSize = 8;
    const arrowOffset = 30;

    // Left arrow
    ctx.beginPath();
    ctx.moveTo(lineX - arrowSize * 2, arrowOffset); // Starting point of left arrow
    ctx.lineTo(lineX - arrowSize / 2, arrowOffset - arrowSize); // Left arrow head left point
    ctx.lineTo(lineX - arrowSize / 2, arrowOffset + arrowSize); // Left arrow head right point
    ctx.closePath();
    ctx.fillStyle = "black";
    ctx.fill();

    // Right arrow
    ctx.beginPath();
    ctx.moveTo(lineX + arrowSize * 2, arrowOffset); // Starting point of right arrow
    ctx.lineTo(lineX + arrowSize / 2, arrowOffset - arrowSize); // Right arrow head left point
    ctx.lineTo(lineX + arrowSize / 2, arrowOffset + arrowSize); // Right arrow head right point
    ctx.closePath();
    ctx.fillStyle = "black";
    ctx.fill();
  }

  // Pointer position in drawing units (the canvas may be scaled to fit the screen)
  function toCanvasX(e) {
    const rect = canvas.getBoundingClientRect();
    return ((e.clientX - rect.left) * canvasWidth) / rect.width;
  }

  // Whether the pointer is close enough to grab the margin line, in screen pixels
  function isNearLine(e) {
    const rect = canvas.getBoundingClientRect();
    const lineScreenX = (lineX * rect.width) / canvasWidth;
    const tolerance = e.pointerType === "mouse" ? 10 : 20;
    return Math.abs(e.clientX - rect.left - lineScreenX) < tolerance;
  }

  // Set the max title width from where the margin line has been dragged to
  function dragMarginTo(x) {
    const offsetChars = Math.max(0, x - canvasWidth / 2) / getCharWidth();
    const newMaxTitleWidth = Math.min(getPageWidth(), Math.max(1, Math.round(2 * offsetChars)));

    if (newMaxTitleWidth !== parseFloat(maxTitleWidth.value)) {
      setMaxTitleWidth(newMaxTitleWidth);
    }
  }

  function stopDragging() {
    if (!isDragging) return;
    isDragging = false;
    canvas.style.cursor = "default";
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (!isNearLine(e)) return;
    isDragging = true;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = "grabbing";
  });

  canvas.addEventListener("pointermove", (e) => {
    if (isDragging) {
      dragMarginTo(toCanvasX(e));
    } else {
      canvas.style.cursor = isNearLine(e) ? "ew-resize" : "default";
    }
  });

  canvas.addEventListener("pointerup", stopDragging);
  canvas.addEventListener("pointercancel", stopDragging);

  // would like this to work but the validation doesn't really work
  function restrictMaxTitleWidth() {
    maxTitleWidth.setAttribute("max", pageWidth.value || DEFAULT_PAGE_WIDTH);
    maxTitleWidthHint.textContent = `Must be between 1 and ${pageWidth.value || DEFAULT_PAGE_WIDTH} (less than page width)`;
  }

  // Update the line position on the canvas with the value from the form
  function positionLineFromInputs() {
    lineX = canvasWidth / 2 + (getMaxTitleWidth() / 2) * getCharWidth();
  }

  function setMaxTitleWidth(value) {
    maxTitleWidth.value = value;
    localStorage.setItem("maxTitleWidth", value);
    positionLineFromInputs();
    renderPageLayout();
  }

  // When anything in the form changes
  function processInputChange(event) {
    const inputId = event.target.id;
    const value = event.target.value;

    if (inputId === "maxTitleWidth" || inputId === "pageWidth") {
      restrictMaxTitleWidth();
    }

    positionLineFromInputs();
    renderPageLayout();
    // save to local storage after every change
    localStorage.setItem(inputId, value);
  }

  matchDevicePixelRatio();
  restoreSavedInputs();

  // Redraw once the font has loaded; until then the canvas falls back to monospace
  document.fonts.load("16px IBM").then(renderPageLayout);

  // Browser zoom and moving between screens can change the pixel ratio
  window.addEventListener("resize", () => {
    if (matchDevicePixelRatio()) drawCanvasContent();
  });

  pageWidth.addEventListener("input", processInputChange);
  pageTitle.addEventListener("input", processInputChange);
  maxTitleWidth.addEventListener("input", processInputChange);
});
