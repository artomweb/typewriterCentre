import "./style.css";
const font = new FontFace("IBM", 'url("/IBMPlexMono-Regular.ttf")');

document.addEventListener("DOMContentLoaded", () => {
  const pageWidth = document.getElementById("pageWidth");
  const pageTitle = document.getElementById("pageTitle");
  const maxTitleWidth = document.getElementById("maxTitleWidth");
  const maxTitleWidthHint = maxTitleWidth.nextElementSibling;
  const canvas = document.getElementById("paperMockup");
  const ctx = canvas.getContext("2d");

  const canvasWidth = 800;
  const canvasHeight = 400;
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  let lineX = canvas.width / 2;
  let isDragging = false;
  let centeredLines;

  // Get the saved values from local storage
  function restoreSavedInputs() {
    const savedWidth = localStorage.getItem("pageWidth");
    const savedTitle = localStorage.getItem("pageTitle");
    const savedMaxTitleWidth = localStorage.getItem("maxTitleWidth");

    if (savedWidth !== null) pageWidth.value = savedWidth;
    if (savedTitle !== null) pageTitle.value = savedTitle;
    if (savedMaxTitleWidth !== null) maxTitleWidth.value = savedMaxTitleWidth;

    restrictMaxTitleWidth();
    renderPageLayout();
  }

  // Calculate the spacing required for the title
  function renderPageLayout() {
    const pageWidthValue = Math.max(1, parseFloat(pageWidth.value) || 100);
    const maxTitleWidthValue = Math.max(
      1,
      Math.min(parseFloat(maxTitleWidth.value) || 20, pageWidthValue)
    );
    const title = pageTitle.value || "";
    const words = title.split(" ");
    let lines = [];
    let currentLine = [];

    words.forEach((word) => {
      if (
        currentLine.join(" ").length + word.length + currentLine.length <=
        maxTitleWidthValue
      ) {
        currentLine.push(word);
      } else {
        lines.push(currentLine.join(" "));
        currentLine = [word];
      }
    });

    if (currentLine.length) lines.push(currentLine.join(" "));

    centeredLines = lines.map((line) => {
      const spacesNeeded = (pageWidthValue - line.length) / 2;
      return { line, spacesNeeded };
    });

    console.log(centeredLines.join("\n")); // Debug: full text layout
    console.log(lines.map((line) => (pageWidthValue - line.length) / 2)); // Debug: indents
    console.log(lines.map((line) => line.length)); // Debug: line lengths

    drawCanvasContent();
  }

  // draw the text and line on the canvas (after clearing)
  function drawCanvasContent() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pageWidthValue = Math.max(1, parseFloat(pageWidth.value) || 100);
    const charWidth = canvasWidth / pageWidthValue;
    const fontSize = charWidth * 1.6;
    ctx.font = `${fontSize}px IBM`;
    ctx.textBaseline = "top";

    const lineHeight = fontSize * 1.2;
    const startY = (canvasHeight - centeredLines.length * lineHeight) / 2;

    centeredLines.forEach((item, index) => {
      const { line, spacesNeeded } = item;

      // Round spacesNeeded when rendering and check if it's a whole number
      const roundedSpacesNeeded = Math.round(spacesNeeded);
      const isWholeNumber = spacesNeeded === roundedSpacesNeeded;

      // Calculate the position of the line based on the rounded spaces
      const spaceCountText = `${spacesNeeded}`.padStart(4, " ");
      const x =
        (canvasWidth - ctx.measureText(`${spaceCountText} ${line}`).width) / 2;

      // Draw space count text in black or red based on if it's a whole number
      ctx.fillStyle = isWholeNumber ? "black" : "red";
      ctx.fillText(spaceCountText, x, startY + index * lineHeight);

      // Draw the actual line in gray
      ctx.fillStyle = "gray";
      ctx.fillText(
        line,
        x + ctx.measureText(spaceCountText).width,
        startY + index * lineHeight
      );
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

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    if (Math.abs(mouseX - lineX) < 10) {
      canvas.style.cursor = "ew-resize";
    } else {
      canvas.style.cursor = "default";
    }

    if (isDragging) {
      lineX = mouseX;
      if (lineX < canvas.width / 2) lineX = canvas.width / 2;
      if (lineX > canvas.width) lineX = canvas.width;

      const pageWidthValue = Math.max(1, parseFloat(pageWidth.value) || 100);
      const charWidth = canvasWidth / pageWidthValue;
      const center = canvasWidth / 2;
      const offsetPixels = Math.abs(lineX - center);
      const offsetChars = offsetPixels / charWidth;
      let newMaxTitleWidth = Math.round(2 * offsetChars);

      // Ensure maxTitleWidth does not go below 1
      newMaxTitleWidth = Math.max(1, newMaxTitleWidth);

      // Update the input field and localStorage only if the value changes
      if (newMaxTitleWidth !== parseFloat(maxTitleWidth.value)) {
        maxTitleWidth.value = newMaxTitleWidth;
        localStorage.setItem("maxTitleWidth", newMaxTitleWidth);
      }

      positionLineFromInputs();
      renderPageLayout();
    }
  });

  canvas.addEventListener("mousedown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    // If the mouse is near the line
    if (Math.abs(mouseX - lineX) < 10) {
      isDragging = true;
      canvas.style.cursor = "grabbing";
    }
  });

  // mouse up anywhere on the page
  document.addEventListener("mouseup", () => {
    isDragging = false;
    canvas.style.cursor = "default";
    drawCanvasContent();
  });

  // would like this to work but the validation doesn't really work
  function restrictMaxTitleWidth() {
    maxTitleWidth.setAttribute("max", pageWidth.value || 100);
    maxTitleWidthHint.textContent = `Must be between 1 and ${
      pageWidth.value || 100
    } (less than page width)`;
  }

  // Update the line position on the canvas with the value from the form
  function positionLineFromInputs() {
    const pageWidthValue = Math.max(1, parseFloat(pageWidth.value) || 100);
    const maxTitleWidthValue = Math.max(
      1,
      Math.min(parseFloat(maxTitleWidth.value) || 20, pageWidthValue)
    );
    const charWidth = canvasWidth / pageWidthValue;
    const center = canvasWidth / 2;
    const offsetChars = maxTitleWidthValue / 2;
    const offsetPixels = offsetChars * charWidth;
    lineX = center + offsetPixels;

    if (lineX < 0) lineX = 0;
    if (lineX > canvasWidth) lineX = canvasWidth;
  }

  // When anything in the form changes
  function processInputChange(event) {
    const inputId = event.target.id;
    const value = event.target.value;

    console.log(`Input ${inputId} changed to: ${value}`);

    if (inputId === "maxTitleWidth") {
      restrictMaxTitleWidth();
    }

    positionLineFromInputs();
    renderPageLayout();
    // save to local storage after every change
    localStorage.setItem(inputId, value);
  }

  restoreSavedInputs();
  positionLineFromInputs();

  // Show page again when font is loaded
  font.load().then(() => {
    renderPageLayout();
  });

  pageWidth.addEventListener("input", processInputChange);
  pageTitle.addEventListener("input", processInputChange);
  maxTitleWidth.addEventListener("input", processInputChange);
});
