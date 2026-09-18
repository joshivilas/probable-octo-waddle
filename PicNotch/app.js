(() => {
  'use strict';

  const byId = (id) => document.getElementById(id);
  const source = byId('source-image');
  const preview = byId('preview');
  const workspace = byId('workspace');
  const download = byId('download');
  const actionIds = ['rotate-left', 'rotate-right', 'flip', 'reset'];
  let cropper = null;
  let paperColor = '#fffdf7';
  let currentName = 'postcard';
  let frame = 0;
  let loadVersion = 0;
  let ready = false;
  let exporting = false;

  if (window.lucide) window.lucide.createIcons();

  function message(text, error = false) {
    byId('message').textContent = text;
    byId('message').classList.toggle('error', error);
  }

  function aspectRatio() {
    return byId('aspect-ratio').value === 'free' ? NaN : Number(byId('aspect-ratio').value);
  }

  function dimensions() {
    const data = cropper.getData();
    const shortSide = Math.max(1, Math.min(data.width, data.height));
    const border = shortSide * Number(byId('border-width').value) / 100;
    const rawWidth = data.width + border * 2;
    const rawHeight = data.height + border * 2;
    const scale = Math.min(1, 4096 / Math.max(rawWidth, rawHeight));
    return { width: Math.max(1, Math.round(rawWidth * scale)), height: Math.max(1, Math.round(rawHeight * scale)), border: border * scale };
  }

  function stamp(context, width, height) {
    const count = [30, 22, 15][Number(byId('perforation').value) - 1];
    const pitch = Math.min(width, height) / count;
    const radius = pitch * 0.31;
    const columns = Math.max(2, Math.round(width / pitch));
    const rows = Math.max(2, Math.round(height / pitch));
    context.save();
    context.globalCompositeOperation = 'destination-out';
    context.beginPath();
    for (let index = 0; index < columns; index++) {
      const center = (index + 0.5) * width / columns;
      context.moveTo(center + radius, 0);
      context.arc(center, 0, radius, 0, Math.PI * 2);
      context.moveTo(center + radius, height);
      context.arc(center, height, radius, 0, Math.PI * 2);
    }
    for (let index = 0; index < rows; index++) {
      const center = (index + 0.5) * height / rows;
      context.moveTo(radius, center);
      context.arc(0, center, radius, 0, Math.PI * 2);
      context.moveTo(width + radius, center);
      context.arc(width, center, radius, 0, Math.PI * 2);
    }
    context.fill();
    context.restore();
  }

  function render(canvas, maxSize = 4096) {
    const size = dimensions();
    const scale = Math.min(1, maxSize / Math.max(size.width, size.height));
    canvas.width = Math.max(1, Math.round(size.width * scale));
    canvas.height = Math.max(1, Math.round(size.height * scale));
    const border = size.border * scale;
    const innerWidth = Math.max(1, canvas.width - border * 2);
    const innerHeight = Math.max(1, canvas.height - border * 2);
    const image = cropper.getCroppedCanvas({ width: Math.round(innerWidth), height: Math.round(innerHeight), maxWidth: 4096, maxHeight: 4096, imageSmoothingEnabled: true, imageSmoothingQuality: 'high' });
    if (!image) throw new Error('No crop available');
    const context = canvas.getContext('2d');
    context.fillStyle = paperColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, border, border, innerWidth, innerHeight);
    stamp(context, canvas.width, canvas.height);
    return size;
  }

  function updatePreview() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (!ready || !cropper) return;
      try {
        const size = render(preview, 700);
        byId('output-size').textContent = `${size.width} x ${size.height} px`;
        byId('export-note').textContent = 'PNG image';
        download.disabled = exporting;
      } catch {
        download.disabled = true;
        message('This crop could not be rendered. Try a smaller image.', true);
      }
    });
  }

  function placeholder() {
    const context = preview.getContext('2d');
    context.fillStyle = paperColor;
    context.fillRect(0, 0, preview.width, preview.height);
    context.fillStyle = '#dde3d9';
    context.fillRect(35, 35, preview.width - 70, preview.height - 70);
    stamp(context, preview.width, preview.height);
  }

  async function loadImage(url, name) {
    const version = ++loadVersion;
    message('Opening image...');
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
      if (version !== loadVersion) return;
      if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 60000000) {
        message('Choose an image smaller than 60 megapixels.', true);
        return;
      }
      ready = false;
      download.disabled = true;
      actionIds.forEach((id) => { byId(id).disabled = true; });
      if (cropper) cropper.destroy();
      source.hidden = false;
      source.src = url;
      byId('empty-state').hidden = true;
      byId('canvas-tag').hidden = false;
      byId('filename').textContent = name;
      byId('source-size').textContent = `${image.naturalWidth} x ${image.naturalHeight}`;
      currentName = name.replace(/\.[^.]+$/, '') || 'postcard';
      cropper = new Cropper(source, {
        aspectRatio: aspectRatio(),
        viewMode: 1,
        dragMode: 'move',
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
          actionIds.forEach((id) => { byId(id).disabled = false; });
          updatePreview();
          message('');
          URL.revokeObjectURL(url);
        },
        crop: updatePreview
      });
    } catch {
      if (version === loadVersion) message('This image could not be opened. Try a PNG, JPEG, WebP, or GIF file.', true);
    } finally {
      if (version !== loadVersion || source.src !== url) URL.revokeObjectURL(url);
    }
  }

  function openFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      message('Please choose an image file.', true);
      return;
    }
    if (file.size > 40 * 1024 * 1024) {
      message('Choose an image smaller than 40 MB.', true);
      return;
    }
    loadImage(URL.createObjectURL(file), file.name);
  }

  ['upload-button', 'empty-upload'].forEach((id) => byId(id).addEventListener('click', () => byId('file-input').click()));
  byId('file-input').addEventListener('change', (event) => {
    openFile(event.target.files[0]);
    event.target.value = '';
  });
  document.addEventListener('dragover', (event) => {
    if (event.dataTransfer.types.includes('Files')) event.preventDefault();
  });
  document.addEventListener('drop', (event) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    workspace.classList.remove('dragging');
    openFile(event.dataTransfer.files[0]);
  });
  workspace.addEventListener('dragenter', (event) => {
    if (event.dataTransfer.types.includes('Files')) workspace.classList.add('dragging');
  });
  workspace.addEventListener('dragleave', (event) => {
    if (!workspace.contains(event.relatedTarget)) workspace.classList.remove('dragging');
  });
  byId('aspect-ratio').addEventListener('change', () => { if (ready) cropper.setAspectRatio(aspectRatio()); });
  byId('rotate-left').addEventListener('click', () => cropper.rotate(-90));
  byId('rotate-right').addEventListener('click', () => cropper.rotate(90));
  byId('flip').addEventListener('click', () => cropper.scaleX(-cropper.getData().scaleX));
  byId('reset').addEventListener('click', () => {
    cropper.reset();
    cropper.setAspectRatio(aspectRatio());
  });
  byId('border-width').addEventListener('input', (event) => {
    byId('border-value').textContent = `${event.target.value}%`;
    updatePreview();
  });
  byId('perforation').addEventListener('input', (event) => {
    byId('perforation-value').textContent = ['Fine', 'Medium', 'Bold'][Number(event.target.value) - 1];
    updatePreview();
  });
  function setColor(color) {
    paperColor = color;
    document.querySelectorAll('.swatch').forEach((button) => {
      const selected = button.dataset.color === color;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    byId('custom-color').value = color;
    if (ready) updatePreview();
    else placeholder();
  }
  document.querySelectorAll('.swatch').forEach((button) => button.addEventListener('click', () => setColor(button.dataset.color)));
  byId('custom-color').addEventListener('input', (event) => setColor(event.target.value));
  download.addEventListener('click', () => {
    if (!ready || exporting) return;
    exporting = true;
    download.disabled = true;
    const exportName = `${currentName}-postcard.png`;
    try {
      const canvas = document.createElement('canvas');
      render(canvas);
      canvas.toBlob((blob) => {
        exporting = false;
        download.disabled = !ready;
        if (!blob) {
          message('The PNG could not be created. Try a smaller crop.', true);
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = exportName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        message('Your postcard is ready. PNG download started.');
      }, 'image/png');
    } catch {
      exporting = false;
      download.disabled = !ready;
      message('This image could not be exported. Try uploading it from your computer.', true);
    }
  });

  function initializeAds() {
    const ad = byId('postcard-ad');
    if (!ad || ad.dataset.enabled !== 'true' || location.protocol !== 'https:') return;
    const client = ad.dataset.adClient;
    const slot = ad.dataset.adSlot;
    if (!/^ca-pub-\d{16}$/.test(client) || !/^\d+$/.test(slot)) return;

    const section = ad.closest('.ad-section');
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
    script.addEventListener('load', () => {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        section.dataset.state = 'active';
      } catch {
        section.dataset.state = 'unavailable';
      }
    });
    script.addEventListener('error', () => { section.dataset.state = 'unavailable'; });
    section.dataset.state = 'loading';
    document.head.appendChild(script);
  }

  initializeAds();
  placeholder();
  if (typeof Cropper === 'undefined') {
    message('The crop library could not load. Connect to the internet and reload this page.', true);
    ['upload-button', 'empty-upload'].forEach((id) => { byId(id).disabled = true; });
  }
})();