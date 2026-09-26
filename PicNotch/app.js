(() => {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const source = byId("source-image");
  const preview = byId("preview");
  const workspace = byId("workspace");
  const download = byId("download");
  const actionIds = ["rotate-left", "rotate-right", "flip", "reset"];
  let cropper = null;
  let paperColor = "#fffdf7";
  let currentName = "postcard";
  let frame = 0;
  let loadVersion = 0;
  let ready = false;
  let exporting = false;
  const styles = {
    postcard: {
      label: "Postcard", icon: "stamp", render: renderPostcard,
      settings: { border: "6", perforation: "2", color: "#fffdf7", ratio: "0.7142857142857143", caption: "", crop: null },
    },
    polaroid: {
      label: "Polaroid", icon: "image", render: renderPolaroid,
      settings: { border: "6", perforation: "2", color: "#fffdf7", ratio: "1", caption: "", crop: null },
    },
  };
  let activeStyle = "postcard";
  const studio = byId("studio-panel");
  const previewDivider = byId("preview-divider");
  const desktopLayout = window.matchMedia("(min-width: 721px)");
  let previewShare = 0.42;
  let resizePointer = null;

  function resizePreview(share = previewShare) {
    if (!desktopLayout.matches) return;
    const width = studio.clientWidth;
    const minimum = Math.max(0.25, 280 / width);
    const maximum = Math.min(0.65, (width - 332) / width);
    previewShare = Math.max(minimum, Math.min(maximum, share));
    studio.style.setProperty("--preview-width", `${previewShare * 100}%`);
    previewDivider.setAttribute("aria-valuemin", Math.round(minimum * 100));
    previewDivider.setAttribute("aria-valuemax", Math.round(maximum * 100));
    previewDivider.setAttribute("aria-valuenow", Math.round(previewShare * 100));
    previewDivider.setAttribute("aria-valuetext", `${Math.round(previewShare * 100)}% preview width`);
  }

  previewDivider.addEventListener("pointerdown", (event) => {
    if (!desktopLayout.matches || event.button !== 0) return;
    event.preventDefault();
    previewDivider.focus();
    resizePointer = event.pointerId;
    previewDivider.setPointerCapture(event.pointerId);
    previewDivider.classList.add("resizing");
  });
  previewDivider.addEventListener("pointermove", (event) => {
    if (event.pointerId !== resizePointer) return;
    const bounds = studio.getBoundingClientRect();
    resizePreview((bounds.right - event.clientX) / studio.clientWidth);
  });
  function finishPreviewResize(event) {
    if (event.pointerId !== resizePointer) return;
    resizePointer = null;
    previewDivider.classList.remove("resizing");
    if (previewDivider.hasPointerCapture(event.pointerId)) {
      previewDivider.releasePointerCapture(event.pointerId);
    }
    window.dispatchEvent(new Event("resize"));
  }
  previewDivider.addEventListener("pointerup", finishPreviewResize);
  previewDivider.addEventListener("pointercancel", finishPreviewResize);
  previewDivider.addEventListener("lostpointercapture", finishPreviewResize);
  previewDivider.addEventListener("keydown", (event) => {
    if (!desktopLayout.matches) return;
    let share;
    if (event.key === "ArrowLeft") share = previewShare + 0.02;
    if (event.key === "ArrowRight") share = previewShare - 0.02;
    if (event.key === "Home") share = 0;
    if (event.key === "End") share = 1;
    if (share === undefined) return;
    event.preventDefault();
    resizePreview(share);
    window.dispatchEvent(new Event("resize"));
  });
  window.addEventListener("resize", () => resizePreview());
  resizePreview();

  Object.entries(styles).forEach(([id, style]) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.id = `style-${id}`;
    tab.className = "style-tab";
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", "studio-panel");
    tab.setAttribute("aria-selected", String(id === activeStyle));
    tab.tabIndex = id === activeStyle ? 0 : -1;
    const icon = document.createElement("i");
    icon.dataset.lucide = style.icon;
    icon.setAttribute("aria-hidden", "true");
    tab.append(icon, document.createTextNode(style.label));
    tab.addEventListener("click", () => selectStyle(id));
    tab.addEventListener("keydown", (event) => {
      const ids = Object.keys(styles);
      const index = ids.indexOf(id);
      let next;
      if (event.key === "ArrowRight") next = (index + 1) % ids.length;
      if (event.key === "ArrowLeft") next = (index - 1 + ids.length) % ids.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = ids.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      selectStyle(ids[next]);
      byId(`style-${ids[next]}`).focus();
    });
    byId("style-tabs").append(tab);
  });

  if (window.lucide) window.lucide.createIcons();

  function selectStyle(id) {
    if (id === activeStyle) return;
    styles[activeStyle].settings = {
      border: byId("border-width").value,
      perforation: byId("perforation").value,
      color: paperColor,
      ratio: byId("aspect-ratio").value,
      caption: byId("caption").value,
      crop: ready ? cropper.getData() : null,
    };
    activeStyle = id;
    const style = styles[id];
    const settings = style.settings;
    byId("border-width").value = settings.border;
    byId("border-value").textContent = `${settings.border}%`;
    byId("perforation").value = settings.perforation;
    byId("perforation-value").textContent = ["Fine", "Medium", "Bold"][Number(settings.perforation) - 1];
    byId("aspect-ratio").value = settings.ratio;
    byId("caption").value = settings.caption;
    Object.keys(styles).forEach((styleId) => {
      const selected = styleId === id;
      byId(`style-${styleId}`).setAttribute("aria-selected", String(selected));
      byId(`style-${styleId}`).tabIndex = selected ? 0 : -1;
      byId(`${styleId}-settings`).hidden = !selected;
    });
    byId("studio-panel").setAttribute("aria-labelledby", `style-${id}`);
    byId("preview-heading").textContent = `YOUR ${style.label.toUpperCase()}`;
    preview.setAttribute("aria-label", `${style.label} preview`);
    byId("output-finish").textContent = id === "postcard" ? "TRANSPARENT" : "PAPER FRAME";
    byId("download-label").textContent = `Save ${id}`;
    if (ready) {
      cropper.setAspectRatio(aspectRatio());
      if (settings.crop) cropper.setData(settings.crop);
    }
    setColor(settings.color);
  }

  function message(text, error = false) {
    byId("message").textContent = text;
    byId("message").classList.toggle("error", error);
  }

  function aspectRatio() {
    return byId("aspect-ratio").value === "free"
      ? NaN
      : Number(byId("aspect-ratio").value);
  }

  function dimensions() {
    const data = cropper.getData();
    const shortSide = Math.max(1, Math.min(data.width, data.height));
    const border = (shortSide * Number(byId("border-width").value)) / 100;
    const rawWidth = data.width + border * 2;
    const rawHeight = data.height + border * 2;
    const scale = Math.min(1, 4096 / Math.max(rawWidth, rawHeight));
    return {
      width: Math.max(1, Math.round(rawWidth * scale)),
      height: Math.max(1, Math.round(rawHeight * scale)),
      border: border * scale,
    };
  }

  function stamp(context, width, height) {
    const count = [30, 22, 15][Number(byId("perforation").value) - 1];
    const pitch = Math.min(width, height) / count;
    const radius = pitch * 0.31;
    const columns = Math.max(2, Math.round(width / pitch));
    const rows = Math.max(2, Math.round(height / pitch));
    context.save();
    context.globalCompositeOperation = "destination-out";
    context.beginPath();
    for (let index = 0; index < columns; index++) {
      const center = ((index + 0.5) * width) / columns;
      context.moveTo(center + radius, 0);
      context.arc(center, 0, radius, 0, Math.PI * 2);
      context.moveTo(center + radius, height);
      context.arc(center, height, radius, 0, Math.PI * 2);
    }
    for (let index = 0; index < rows; index++) {
      const center = ((index + 0.5) * height) / rows;
      context.moveTo(radius, center);
      context.arc(0, center, radius, 0, Math.PI * 2);
      context.moveTo(width + radius, center);
      context.arc(width, center, radius, 0, Math.PI * 2);
    }
    context.fill();
    context.restore();
  }

  function render(canvas, maxSize = 4096) {
    return styles[activeStyle].render(canvas, maxSize);
  }

  function renderPostcard(canvas, maxSize = 4096) {
    const size = dimensions();
    const scale = Math.min(1, maxSize / Math.max(size.width, size.height));
    canvas.width = Math.max(1, Math.round(size.width * scale));
    canvas.height = Math.max(1, Math.round(size.height * scale));
    const border = size.border * scale;
    const innerWidth = Math.max(1, canvas.width - border * 2);
    const innerHeight = Math.max(1, canvas.height - border * 2);
    const image = cropper.getCroppedCanvas({
      width: Math.round(innerWidth),
      height: Math.round(innerHeight),
      maxWidth: 4096,
      maxHeight: 4096,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
    });
    if (!image) throw new Error("No crop available");
    const context = canvas.getContext("2d");
    context.fillStyle = paperColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, border, border, innerWidth, innerHeight);
    stamp(context, canvas.width, canvas.height);
    return size;
  }

  function drawCaption(context, width, height, border, bottom) {
    const caption = byId("caption").value.trim();
    if (!caption) return;
    const available = Math.max(1, width - border * 2 - width * 0.04);
    let fontSize = bottom * 0.25;
    context.font = `500 ${fontSize}px "DM Sans", sans-serif`;
    fontSize *= Math.min(1, available / Math.max(1, context.measureText(caption).width));
    context.font = `500 ${fontSize}px "DM Sans", sans-serif`;
    const channels = paperColor.slice(1).match(/.{2}/g).map((channel) => parseInt(channel, 16));
    const brightness = channels[0] * 0.299 + channels[1] * 0.587 + channels[2] * 0.114;
    context.fillStyle = brightness > 140 ? "#192c26" : "#ffffff";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(caption, width / 2, height - bottom / 2);
  }

  function renderPolaroid(canvas, maxSize = 4096) {
    const data = cropper.getData();
    const shortSide = Math.max(1, Math.min(data.width, data.height));
    const paperBorder = shortSide * Number(byId("border-width").value) / 100;
    const bottomMargin = paperBorder + shortSide * 0.22;
    const rawWidth = data.width + paperBorder * 2;
    const rawHeight = data.height + paperBorder + bottomMargin;
    const outputScale = Math.min(1, 4096 / Math.max(rawWidth, rawHeight));
    const size = {
      width: Math.max(1, Math.round(rawWidth * outputScale)),
      height: Math.max(1, Math.round(rawHeight * outputScale)),
    };
    const scale = Math.min(1, maxSize / Math.max(size.width, size.height));
    canvas.width = Math.max(1, Math.round(size.width * scale));
    canvas.height = Math.max(1, Math.round(size.height * scale));
    const border = paperBorder * outputScale * scale;
    const bottom = bottomMargin * outputScale * scale;
    const innerWidth = Math.max(1, canvas.width - border * 2);
    const innerHeight = Math.max(1, canvas.height - border - bottom);
    const image = cropper.getCroppedCanvas({
      width: Math.max(1, Math.round(innerWidth)),
      height: Math.max(1, Math.round(innerHeight)),
      maxWidth: 4096, maxHeight: 4096,
      imageSmoothingEnabled: true, imageSmoothingQuality: "high",
    });
    if (!image) throw new Error("No crop available");
    const context = canvas.getContext("2d");
    context.fillStyle = paperColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, border, border, innerWidth, innerHeight);
    drawCaption(context, canvas.width, canvas.height, border, bottom);
    return size;
  }

  function updatePreview() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (!ready || !cropper) return;
      try {
        const size = render(preview, 700);
        byId("output-size").textContent = `${size.width} x ${size.height} px`;
        byId("export-note").textContent = "PNG image";
        download.disabled = exporting;
      } catch {
        download.disabled = true;
        message("This crop could not be rendered. Try a smaller image.", true);
      }
    });
  }

  function placeholder() {
    preview.width = 500;
    preview.height = activeStyle === "postcard" ? 650 : 600;
    const context = preview.getContext("2d");
    context.fillStyle = paperColor;
    context.fillRect(0, 0, preview.width, preview.height);
    context.fillStyle = "#dde3d9";
    const bottom = activeStyle === "postcard" ? 35 : 135;
    context.fillRect(35, 35, preview.width - 70, preview.height - 35 - bottom);
    if (activeStyle === "postcard") stamp(context, preview.width, preview.height);
    else drawCaption(context, preview.width, preview.height, 35, bottom);
  }

  async function loadImage(url, name) {
    const version = ++loadVersion;
    message("Opening image...");
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
      if (version !== loadVersion) return;
      if (
        !image.naturalWidth ||
        image.naturalWidth * image.naturalHeight > 60000000
      ) {
        message("Choose an image smaller than 60 megapixels.", true);
        return;
      }
      ready = false;
      Object.values(styles).forEach((style) => { style.settings.crop = null; });
      download.disabled = true;
      actionIds.forEach((id) => {
        byId(id).disabled = true;
      });
      if (cropper) cropper.destroy();
      source.hidden = false;
      source.src = url;
      byId("empty-state").hidden = true;
      byId("canvas-tag").hidden = false;
      byId("filename").textContent = name;
      byId("source-size").textContent =
        `${image.naturalWidth} x ${image.naturalHeight}`;
      currentName = name.replace(/\.[^.]+$/, "") || "postcard";
      cropper = new Cropper(source, {
        aspectRatio: aspectRatio(),
        viewMode: 1,
        dragMode: "move",
        autoCropArea: 0.78,
        background: false,
        responsive: true,
        checkCrossOrigin: false,
        toggleDragModeOnDblclick: false,
        minCropBoxWidth: 24,
        minCropBoxHeight: 24,
        ready() {
          if (version !== loadVersion) return;
          ready = true;
          actionIds.forEach((id) => {
            byId(id).disabled = false;
          });
          updatePreview();
          message("");
          URL.revokeObjectURL(url);
        },
        crop: updatePreview,
      });
    } catch {
      if (version === loadVersion)
        message(
          "This image could not be opened. Try a PNG, JPEG, WebP, or GIF file.",
          true,
        );
    } finally {
      if (version !== loadVersion || source.src !== url)
        URL.revokeObjectURL(url);
    }
  }

  function openFile(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      message("Please choose an image file.", true);
      return;
    }
    if (file.size > 40 * 1024 * 1024) {
      message("Choose an image smaller than 40 MB.", true);
      return;
    }
    loadImage(URL.createObjectURL(file), file.name);
  }

  ["upload-button", "empty-upload"].forEach((id) =>
    byId(id).addEventListener("click", () => byId("file-input").click()),
  );
  byId("file-input").addEventListener("change", (event) => {
    openFile(event.target.files[0]);
    event.target.value = "";
  });
  document.addEventListener("dragover", (event) => {
    if (event.dataTransfer.types.includes("Files")) event.preventDefault();
  });
  document.addEventListener("drop", (event) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    workspace.classList.remove("dragging");
    openFile(event.dataTransfer.files[0]);
  });
  workspace.addEventListener("dragenter", (event) => {
    if (event.dataTransfer.types.includes("Files"))
      workspace.classList.add("dragging");
  });
  workspace.addEventListener("dragleave", (event) => {
    if (!workspace.contains(event.relatedTarget))
      workspace.classList.remove("dragging");
  });
  byId("aspect-ratio").addEventListener("change", () => {
    if (ready) cropper.setAspectRatio(aspectRatio());
  });
  byId("rotate-left").addEventListener("click", () => cropper.rotate(-90));
  byId("rotate-right").addEventListener("click", () => cropper.rotate(90));
  byId("flip").addEventListener("click", () =>
    cropper.scaleX(-cropper.getData().scaleX),
  );
  byId("reset").addEventListener("click", () => {
    cropper.reset();
    cropper.setAspectRatio(aspectRatio());
  });
  byId("border-width").addEventListener("input", (event) => {
    byId("border-value").textContent = `${event.target.value}%`;
    updatePreview();
  });
  byId("perforation").addEventListener("input", (event) => {
    byId("perforation-value").textContent = ["Fine", "Medium", "Bold"][
      Number(event.target.value) - 1
    ];
    updatePreview();
  });
  byId("caption").addEventListener("input", () => {
    if (ready) updatePreview();
    else placeholder();
  });
  function setColor(color) {
    paperColor = color;
    document.querySelectorAll(".swatch").forEach((button) => {
      const selected = button.dataset.color === color;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    byId("custom-color").value = color;
    if (ready) updatePreview();
    else placeholder();
  }
  document
    .querySelectorAll(".swatch")
    .forEach((button) =>
      button.addEventListener("click", () => setColor(button.dataset.color)),
    );
  byId("custom-color").addEventListener("input", (event) =>
    setColor(event.target.value),
  );
  download.addEventListener("click", () => {
    if (!ready || exporting) return;
    exporting = true;
    download.disabled = true;
    const exportStyle = activeStyle;
    const exportName = `${currentName}-${exportStyle}.png`;
    try {
      const canvas = document.createElement("canvas");
      render(canvas);
      canvas.toBlob((blob) => {
        exporting = false;
        download.disabled = !ready;
        if (!blob) {
          message("The PNG could not be created. Try a smaller crop.", true);
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = exportName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        message(`Your ${exportStyle} is ready. PNG download started.`);
      }, "image/png");
    } catch {
      exporting = false;
      download.disabled = !ready;
      message(
        "This image could not be exported. Try uploading it from your computer.",
        true,
      );
    }
  });

  placeholder();
  if (typeof Cropper === "undefined") {
    message(
      "The crop library could not load. Connect to the internet and reload this page.",
      true,
    );
    ["upload-button", "empty-upload"].forEach((id) => {
      byId(id).disabled = true;
    });
  }
})();
