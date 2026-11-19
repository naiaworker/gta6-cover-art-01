// Neon Palms Cover Studio — the editor.
//
// One cover state (src/cover.js) drives everything: the controls edit it, the canvas previews it at the
// exact export size, and Export saves that canvas as a PNG. Photos live in a small library (the bundled
// samples plus whatever the person drops in — read locally, never uploaded). A picked photo is placed by
// clicking a panel; the selected panel's photo can be dragged and zoomed right on the cover.
//
// A `?shot=` query builds a fixed scene instead (./shots.js), for screenshots.
import {
  CAPTION_COLORS,
  GRADES,
  SIZES,
  TEMPLATES,
  createCoverState,
  panelRects,
  renderCover,
  syncPanels,
} from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const SAMPLES = [
  { name: 'boulevard', label: 'Boulevard' },
  { name: 'pier', label: 'Pier' },
  { name: 'cat', label: 'Cat' },
];

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

const library = []; // { img, label }
let picked = 0; // library index of the photo the next panel click places
let selected = 0; // panel index being fine-tuned
const state = createCoverState();

function photos() {
  return library.map((entry) => entry.img);
}

/** Paints the preview at the state's export size; `outline` marks the selected panel (editor only —
 *  exports repaint without it first). */
function redraw(outline = true) {
  const [w, h] = SIZES[state.size];
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  renderCover(ctx, state, w, h);
  if (outline) drawSelection(w, h);
  updatePanelInfo();
}

function drawSelection(w, h) {
  const rect = panelRects(state, w, h)[selected];
  if (!rect) return;
  ctx.save();
  ctx.strokeStyle = '#ff2e7e';
  ctx.lineWidth = Math.max(3, w * 0.004);
  ctx.setLineDash([w * 0.012, w * 0.008]);
  ctx.strokeRect(rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6);
  ctx.restore();
}

function updatePanelInfo() {
  const info = document.getElementById('panelInfo');
  if (info) info.textContent = `Panel ${selected + 1} of ${state.panels.length}`;
  const zoom = document.getElementById('zoom');
  if (zoom && state.panels[selected]) zoom.value = Math.round((state.panels[selected].zoom || 1) * 100);
}

/** Marks the active button in a segmented group (and its siblings inactive). */
function setActive(groupSelector, attr, value) {
  document.querySelectorAll(`${groupSelector} [data-${attr}]`).forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset[attr] === String(value));
  });
}

/** Rebuilds the photo thumbnail strip from the library. */
function renderThumbs() {
  const box = document.getElementById('thumbs');
  box.replaceChildren();
  library.forEach((entry, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `thumb${i === picked ? ' is-picked' : ''}`;
    const img = document.createElement('img');
    img.src = entry.img.src;
    img.alt = entry.label;
    const name = document.createElement('span');
    name.className = 'thumb-name';
    name.textContent = entry.label;
    btn.append(img, name);
    btn.addEventListener('click', () => {
      picked = i;
      renderThumbs();
      status.textContent = `${entry.label} picked — click a panel to place it.`;
    });
    box.append(btn);
  });
}

/** Builds the grade buttons (with a gradient chip each) and the caption colour swatches. */
function buildPickers() {
  const gradeBox = document.getElementById('grades');
  const chipFor = {
    vice: 'linear-gradient(180deg, #2b1054, #e85d3d 62%, #d6206e)',
    neon: 'linear-gradient(180deg, #003c5a, #101018 55%, #ff2b96)',
    teal: 'linear-gradient(180deg, #006e78, #7a4a21 70%, #ff7a1a)',
    noir: 'linear-gradient(180deg, #e8e8e8, #555 55%, #0a0a0a)',
    none: 'linear-gradient(180deg, #9db4c0, #e8ddc8)',
  };
  for (const [key, grade] of Object.entries(GRADES)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `grade${key === state.grade ? ' is-active' : ''}`;
    btn.dataset.grade = key;
    const chip = document.createElement('span');
    chip.className = 'grade-chip';
    chip.style.background = chipFor[key];
    btn.append(chip, document.createTextNode(grade.label));
    btn.addEventListener('click', () => {
      state.grade = key;
      setActive('#grades', 'grade', key);
      redraw();
    });
    gradeBox.append(btn);
  }
  const swatchBox = document.getElementById('captionColors');
  for (const color of CAPTION_COLORS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `swatch${color === state.captionColor ? ' is-active' : ''}`;
    btn.dataset.color = color;
    btn.style.background = color;
    btn.setAttribute('aria-label', `Title colour ${color}`);
    btn.addEventListener('click', () => {
      state.captionColor = color;
      setActive('#captionColors', 'color', color);
      redraw();
    });
    swatchBox.append(btn);
  }
}

/** Adds photos from files to the library and deals them into the panels from the selected one on. */
async function addFiles(files) {
  const images = [];
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const img = await loadImage(URL.createObjectURL(file));
    library.push({ img, label: file.name.replace(/\.[^.]+$/, '').slice(0, 18) || 'Photo' });
    images.push(img);
  }
  if (!images.length) return;
  picked = library.length - images.length;
  images.forEach((img, k) => {
    const panel = state.panels[(selected + k) % state.panels.length];
    if (panel) {
      panel.photo = img;
      panel.zoom = 1;
      panel.panX = 0.5;
      panel.panY = 0.5;
    }
  });
  renderThumbs();
  redraw();
  status.textContent = `${images.length} photo${images.length > 1 ? 's' : ''} added and placed. Drag to adjust, then Export PNG.`;
}

/** Wires every control in the sidebar and top bar to the state. */
function wireControls() {
  document.querySelectorAll('[data-size]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.size = btn.dataset.size;
      setActive('.topbar-actions .segmented', 'size', state.size);
      redraw();
    });
  });
  document.querySelectorAll('[data-template]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.template = btn.dataset.template;
      selected = 0;
      syncPanels(state, photos());
      setActive('[aria-label="Panel layout"]', 'template', state.template);
      redraw();
    });
  });
  document.querySelectorAll('[data-pos]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.captionPos = btn.dataset.pos;
      setActive('[aria-label="Caption position"]', 'pos', state.captionPos);
      redraw();
    });
  });
  const caption = document.getElementById('caption');
  const tagline = document.getElementById('tagline');
  caption.addEventListener('input', () => {
    state.caption = caption.value;
    redraw();
  });
  tagline.addEventListener('input', () => {
    state.tagline = tagline.value;
    redraw();
  });
  document.getElementById('captionSize').addEventListener('input', (e) => {
    state.captionScale = Number(e.target.value) / 100;
    redraw();
  });
  document.getElementById('frame').addEventListener('change', (e) => {
    state.frame = e.target.checked;
    redraw();
  });
  document.getElementById('zoom').addEventListener('input', (e) => {
    const panel = state.panels[selected];
    if (!panel) return;
    panel.zoom = Number(e.target.value) / 100;
    redraw();
  });
  document.getElementById('resetPanel').addEventListener('click', () => {
    const panel = state.panels[selected];
    if (!panel) return;
    panel.zoom = 1;
    panel.panX = 0.5;
    panel.panY = 0.5;
    redraw();
  });
  document.getElementById('fillAll').addEventListener('click', () => {
    const img = library[picked]?.img;
    if (!img) return;
    state.panels.forEach((panel) => {
      panel.photo = img;
    });
    redraw();
    status.textContent = 'Every panel now shows the picked photo.';
  });
  document.getElementById('export').addEventListener('click', exportPng);

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });
  fileInput.addEventListener('change', () => addFiles([...fileInput.files]));
  for (const evt of ['dragover', 'dragenter']) {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('is-dragging');
    });
  }
  for (const evt of ['dragleave', 'drop']) {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove('is-dragging');
    });
  }
  dropzone.addEventListener('drop', (e) => addFiles([...e.dataTransfer.files]));
}

/** Saves the current canvas as the PNG at the state's size — repainted clean, without the selection. */
function exportPng() {
  redraw(false);
  canvas.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `neon-palms-cover-${state.size}.png`;
    a.click();
    status.textContent = `Saved neon-palms-cover-${state.size}.png`;
    redraw(true);
  }, 'image/png');
}

/** Canvas pointer work: click selects a panel (and places the picked photo if the panel was clicked
 *  without dragging); drag pans the selected panel's photo; wheel zooms it. */
function wireCanvas() {
  let drag = null;
  const toCanvas = (e) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * canvas.width,
      y: ((e.clientY - r.top) / r.height) * canvas.height,
    };
  };
  const panelAt = (pt) => panelRects(state, canvas.width, canvas.height)
    .findIndex((r) => pt.x >= r.x && pt.x < r.x + r.w && pt.y >= r.y && pt.y < r.y + r.h);

  canvas.addEventListener('pointerdown', (e) => {
    const pt = toCanvas(e);
    const idx = panelAt(pt);
    if (idx === -1) return;
    selected = idx;
    drag = { x: pt.x, y: pt.y, moved: false, panX: state.panels[idx].panX, panY: state.panels[idx].panY };
    canvas.setPointerCapture(e.pointerId);
    redraw();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const pt = toCanvas(e);
    const panel = state.panels[selected];
    if (!panel || !panel.photo) return;
    const rect = panelRects(state, canvas.width, canvas.height)[selected];
    const base = Math.max(rect.w / panel.photo.naturalWidth, rect.h / panel.photo.naturalHeight);
    const dw = panel.photo.naturalWidth * base * panel.zoom;
    const dh = panel.photo.naturalHeight * base * panel.zoom;
    const dx = pt.x - drag.x;
    const dy = pt.y - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    if (dw > rect.w) panel.panX = Math.min(1, Math.max(0, drag.panX - dx / (dw - rect.w)));
    if (dh > rect.h) panel.panY = Math.min(1, Math.max(0, drag.panY - dy / (dh - rect.h)));
    redraw();
  });
  canvas.addEventListener('pointerup', (e) => {
    if (drag && !drag.moved) {
      const panel = state.panels[selected];
      const img = library[picked]?.img;
      if (panel && img && panel.photo !== img) {
        panel.photo = img;
        panel.zoom = 1;
        panel.panX = 0.5;
        panel.panY = 0.5;
      }
    }
    drag = null;
    redraw();
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const pt = toCanvas(e);
    const idx = panelAt(pt);
    if (idx === -1) return;
    selected = idx;
    const panel = state.panels[selected];
    if (!panel) return;
    panel.zoom = Math.min(3.2, Math.max(1, panel.zoom * (e.deltaY < 0 ? 1.07 : 0.93)));
    redraw();
  }, { passive: false });
}

/** Reflects a state built elsewhere (a shot scene) in the controls, so the editor shows it faithfully. */
function applyStateToControls() {
  document.getElementById('caption').value = state.caption;
  document.getElementById('tagline').value = state.tagline;
  document.getElementById('captionSize').value = Math.round(state.captionScale * 100);
  document.getElementById('frame').checked = state.frame;
  setActive('.topbar-actions .segmented', 'size', state.size);
  setActive('[aria-label="Panel layout"]', 'template', state.template);
  setActive('[aria-label="Caption position"]', 'pos', state.captionPos);
  setActive('#grades', 'grade', state.grade);
  setActive('#captionColors', 'color', state.captionColor);
}

async function init() {
  buildPickers();
  wireControls();
  wireCanvas();
  for (const sample of SAMPLES) {
    library.push({ img: await loadImage(`samples/${sample.name}.jpg`), label: sample.label });
  }
  renderThumbs();

  const query = new URLSearchParams(location.search);
  const shot = query.get('shot');
  if (shot) {
    const scene = await runShot(shot, query, loadImage);
    Object.assign(state, scene);
    selected = 0;
    applyStateToControls();
    await document.fonts.ready;
    redraw(shot === 'editor');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.__shotReady = true;
    }));
    return;
  }
  syncPanels(state, photos());
  await document.fonts.ready;
  redraw();
}

init();
