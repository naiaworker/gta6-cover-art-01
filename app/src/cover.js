// Neon Palms Cover Studio — the poster engine.
//
// renderCover() paints a complete cover onto any 2D context at any size: a multi-panel photo collage with
// white keylines, one colour grade over the whole poster, and a bold display caption with a poster-style
// hard shadow. The editor's live preview and the PNG export call the same function, so what you see is
// exactly what you save.
//
// Design notes (Refactoring UI, applied to a poster instead of a page): one hero panel carries the
// hierarchy, every other panel is de-emphasised by size; spacing (the keyline gaps) comes from one scale
// tied to the canvas width; the caption uses exactly two typefaces and three text colours at most.

/** The three export sizes, as [width, height]. */
export const SIZES = {
  '1080x1080': [1080, 1080],
  '1080x1350': [1080, 1350],
  '1920x1080': [1920, 1080],
};

/** Panel rectangles for a template, as fractions of the canvas [x, y, w, h]. */
export const TEMPLATES = {
  collage: {
    label: 'Collage · 5 panels',
    panels: [
      [0, 0, 0.6, 0.56],
      [0.6, 0, 0.4, 0.56],
      [0, 0.56, 0.34, 0.44],
      [0.34, 0.56, 0.33, 0.44],
      [0.67, 0.56, 0.33, 0.44],
    ],
  },
  triptych: {
    label: 'Triptych · 3 panels',
    panels: [
      [0, 0, 1 / 3, 1],
      [1 / 3, 0, 1 / 3, 1],
      [2 / 3, 0, 1 / 3, 1],
    ],
  },
  hero: {
    label: 'Hero + strip',
    panels: [
      [0, 0, 1, 0.7],
      [0, 0.7, 1 / 3, 0.3],
      [1 / 3, 0.7, 1 / 3, 0.3],
      [2 / 3, 0.7, 1 / 3, 0.3],
    ],
  },
};

/** Colour grades: a canvas filter applied to each photo as it is drawn, plus an overlay painted over the
 *  finished collage. `filter` strings are the ones Chrome's canvas accepts. `vignette` is the strength of
 *  the dark edge falloff painted last; `glow` is an optional second gradient composited in screen mode,
 *  for the bloom of neon light. */
export const GRADES = {
  vice: {
    label: 'Vice Sunset',
    filter: 'saturate(1.45) contrast(1.09) brightness(1.01)',
    overlay: [
      [0, 'rgba(26, 8, 58, 0.46)'],
      [0.36, 'rgba(26, 8, 58, 0)'],
      [0.72, 'rgba(255, 94, 58, 0.24)'],
      [1, 'rgba(216, 32, 110, 0.55)'],
    ],
    overlayMode: 'source-over',
    vignette: 0.48,
  },
  neon: {
    label: 'Neon Nights',
    filter: 'saturate(1.9) contrast(1.24) brightness(0.74)',
    overlay: [
      [0, 'rgba(2, 0, 26, 0.60)'],
      [0.35, 'rgba(0, 40, 70, 0.18)'],
      [0.62, 'rgba(0, 229, 255, 0.10)'],
      [1, 'rgba(255, 43, 150, 0.52)'],
    ],
    overlayMode: 'source-over',
    glow: [
      [0, 'rgba(0, 229, 255, 0.16)'],
      [0.5, 'rgba(0, 0, 0, 0)'],
      [1, 'rgba(255, 43, 150, 0.22)'],
    ],
    vignette: 0.58,
  },
  teal: {
    label: 'Teal & Orange',
    filter: 'saturate(1.22) contrast(1.07)',
    overlay: [
      [0, 'rgba(0, 110, 120, 0.26)'],
      [0.55, 'rgba(0, 110, 120, 0)'],
      [1, 'rgba(255, 122, 26, 0.26)'],
    ],
    overlayMode: 'source-over',
    vignette: 0.3,
  },
  noir: {
    label: 'Noir B&W',
    filter: 'grayscale(1) contrast(1.32) brightness(1.02)',
    overlay: [
      [0, 'rgba(255, 255, 255, 0.06)'],
      [1, 'rgba(0, 0, 0, 0.22)'],
    ],
    overlayMode: 'source-over',
    vignette: 0.3,
  },
  none: {
    label: 'No grade',
    filter: 'none',
    overlay: [],
    overlayMode: 'source-over',
    vignette: 0.3,
  },
};

/** Photo styles: how each panel's photo is treated before the grade overlay goes over the collage.
 *  `photo` leaves the photo as shot; `gameart` paints it into flat-shaded, ink-edged poster art
 *  (see stylizeGameArt). A style combines with any colour grade. */
export const STYLES = {
  photo: { label: 'Photo' },
  gameart: { label: 'Game Art' },
};

/** Caption fill colours offered in the editor. */
export const CAPTION_COLORS = ['#ffffff', '#ffd23f', '#ff5da2', '#3fd9ff', '#111114'];

/** The default vertical focal point of a freshly placed photo. Faces usually sit in the upper part of a
 *  photo, so the default crop is biased a little above centre: a centred crop of a portrait photo in a
 *  wide panel would slice straight through the subject's head. */
export const FOCAL_PAN_Y = 0.42;

/** A fresh cover state: no photos yet, the collage template, the Vice Sunset grade. */
export function createCoverState() {
  return {
    template: 'collage',
    grade: 'vice',
    style: 'photo',
    size: '1080x1080',
    caption: 'MIDNIGHT PALMS',
    tagline: 'NEON COAST STORIES',
    captionScale: 1,
    captionColor: '#ffffff',
    captionPos: 'top',
    frame: true,
    panels: [],
  };
}

/** The panel rectangles of the state's template at canvas size w x h, in pixels. */
export function panelRects(state, w, h) {
  return TEMPLATES[state.template].panels.map(([fx, fy, fw, fh]) => ({
    x: Math.round(fx * w),
    y: Math.round(fy * h),
    w: Math.round(fw * w),
    h: Math.round(fh * h),
  }));
}

/** Ensures state.panels has one slot per panel of the current template, keeping photos where they fit. */
export function syncPanels(state, photos) {
  const count = TEMPLATES[state.template].panels.length;
  const next = [];
  for (let i = 0; i < count; i += 1) {
    const old = state.panels[i];
    if (old) {
      next.push(old);
    } else {
      next.push({ photo: photos.length ? photos[i % photos.length] : null, zoom: 1, panX: 0.5, panY: FOCAL_PAN_Y });
    }
  }
  state.panels = next;
  return state;
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

/** Draws one photo into a panel rect with cover-fit, the panel's zoom and pan, and the grade's filter. */
function drawPanelPhoto(ctx, panel, rect, filter) {
  const img = panel.photo;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (!img) {
    // An empty panel still reads as designed: a deep dusk gradient with a soft sun disc.
    const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    g.addColorStop(0, '#3a2358');
    g.addColorStop(0.6, '#8a2a5e');
    g.addColorStop(1, '#e85d3d');
    ctx.fillStyle = g;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = 'rgba(255, 214, 140, 0.85)';
    ctx.beginPath();
    ctx.arc(rect.x + rect.w * 0.5, rect.y + rect.h * 0.62, Math.min(rect.w, rect.h) * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const scale = base * (panel.zoom || 1);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = rect.x + (rect.w - dw) * clamp01(panel.panX ?? 0.5);
  const dy = rect.y + (rect.h - dh) * clamp01(panel.panY ?? FOCAL_PAN_Y);
  ctx.filter = filter;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.filter = 'none';
  ctx.restore();
}

/** The Game Art treatment, painted over one panel's drawn photo: saturation is pushed, contrast is
 *  reshaped, tones are posterized into flat cel bands (7 levels per channel), and a Sobel edge pass
 *  darkens the contours — the inked-outline look of a game poster. Pure per-pixel arithmetic on the
 *  panel's own pixels, so an export is deterministic and identical every run. */
function stylizeGameArt(ctx, rect) {
  const { x, y, w, h } = rect;
  if (w < 3 || h < 3) return;
  const img = ctx.getImageData(x, y, w, h);
  const d = img.data;
  const n = w * h;
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const o = i * 4;
    lum[i] = (d[o] * 0.299 + d[o + 1] * 0.587 + d[o + 2] * 0.114) / 255;
  }
  const LEVELS = 7;
  const SATURATION = 1.32;
  const CONTRAST = 1.12;
  for (let yy = 0; yy < h; yy += 1) {
    for (let xx = 0; xx < w; xx += 1) {
      const i = yy * w + xx;
      const up = yy > 0 ? i - w : i;
      const dn = yy < h - 1 ? i + w : i;
      const lf = xx > 0 ? -1 : 0;
      const rt = xx < w - 1 ? 1 : 0;
      const gx = (lum[up + rt] + 2 * lum[i + rt] + lum[dn + rt])
        - (lum[up + lf] + 2 * lum[i + lf] + lum[dn + lf]);
      const gy = (lum[dn + lf] + 2 * lum[dn] + lum[dn + rt])
        - (lum[up + lf] + 2 * lum[up] + lum[up + rt]);
      const mag = Math.sqrt(gx * gx + gy * gy) / 4;
      const edge = Math.min(0.85, Math.max(0, (mag - 0.08) * 1.8));
      const keep = 1 - edge;
      const o = i * 4;
      const L = lum[i];
      for (let c = 0; c < 3; c += 1) {
        let v = d[o + c] / 255;
        v = L + (v - L) * SATURATION;
        v = (v - 0.5) * CONTRAST + 0.5;
        v = Math.min(1, Math.max(0, v));
        v = Math.round(v * (LEVELS - 1)) / (LEVELS - 1);
        d[o + c] = v * keep * 255;
      }
    }
  }
  ctx.putImageData(img, x, y);
}

/** Paints the grade's overlay gradient, its optional glow, and a vignette over the whole collage. */
function paintGradeOverlay(ctx, grade, w, h) {
  const paintStops = (stops, mode) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    for (const [stop, color] of stops) g.addColorStop(stop, color);
    ctx.save();
    ctx.globalCompositeOperation = mode;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  };
  if (grade.overlay.length) paintStops(grade.overlay, grade.overlayMode);
  if (grade.glow) paintStops(grade.glow, 'screen');
  const strength = grade.vignette ?? 0.3;
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.78);
  v.addColorStop(0, 'rgba(0, 0, 0, 0)');
  v.addColorStop(1, `rgba(0, 0, 0, ${strength})`);
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}

/** Fits a font size for `text` so it spans at most maxWidth, starting from `want`. */
function fitFontSize(ctx, text, fontSpec, want, maxWidth) {
  let size = want;
  ctx.font = fontSpec(size);
  while (ctx.measureText(text).width > maxWidth && size > 10) {
    size *= 0.94;
    ctx.font = fontSpec(size);
  }
  return size;
}

/** One line of poster lettering: hard shadow, thick dark stroke, then the fill. */
function posterText(ctx, text, cx, baseline, size, fill) {
  ctx.font = `${size}px "Anton", "Plus Jakarta Sans", sans-serif`;
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(10, 6, 4, 0.5)';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = size * 0.045;
  ctx.shadowOffsetY = size * 0.055;
  ctx.strokeStyle = '#16100d';
  ctx.lineWidth = size * 0.17;
  ctx.strokeText(text, cx, baseline);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = fill;
  ctx.fillText(text, cx, baseline);
}

/** Centred text drawn letter by letter with `tracking` px between glyphs (for the tagline). */
function drawTrackedText(ctx, text, cx, baseline, tracking) {
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1);
  let x = cx - total / 2;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((ch, i) => {
    ctx.fillText(ch, x, baseline);
    x += widths[i] + tracking;
  });
  ctx.textAlign = prevAlign;
}

/** The caption block: the title in the display face with poster lettering, the tagline letterspaced
 *  beneath it (or above it, at the foot). Anchored to the top or the foot of the cover. */
function drawCaption(ctx, state, w, h) {
  const title = (state.caption || '').trim().toUpperCase();
  const tagline = (state.tagline || '').trim().toUpperCase();
  if (!title && !tagline) return;
  const scale = state.captionScale || 1;
  const atTop = state.captionPos !== 'bottom';
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  let titleSize = 0;
  if (title) {
    titleSize = fitFontSize(ctx, title, (s) => `${s}px "Anton", sans-serif`, h * 0.118 * scale, w * 0.92);
  }
  let tagSize = 0;
  if (tagline) {
    tagSize = fitFontSize(ctx, tagline, (s) => `800 ${s}px "Plus Jakarta Sans", sans-serif`, h * 0.027 * scale, w * 0.8);
  }
  const gap = title && tagline ? h * 0.02 : 0;
  const blockH = titleSize + gap + tagSize;
  const pad = h * 0.05;
  let top = atTop ? pad : h - pad - blockH;

  const drawTagline = (baseline) => {
    ctx.font = `800 ${tagSize}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = tagSize * 0.35;
    ctx.shadowOffsetY = tagSize * 0.08;
    drawTrackedText(ctx, tagline, w / 2, baseline, tagSize * 0.34);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  };

  if (atTop) {
    if (title) posterText(ctx, title, w / 2, top + titleSize, titleSize, state.captionColor);
    if (tagline) drawTagline(top + titleSize + gap + tagSize);
  } else {
    if (tagline) drawTagline(top + tagSize);
    if (title) posterText(ctx, title, w / 2, top + tagSize + gap + titleSize, titleSize, state.captionColor);
  }
  ctx.restore();
}

/** Paints the whole cover described by `state` onto ctx at w x h. */
export function renderCover(ctx, state, w, h) {
  const grade = GRADES[state.grade] ?? GRADES.vice;
  const rects = panelRects(state, w, h);
  ctx.save();
  ctx.fillStyle = '#0b0b0e';
  ctx.fillRect(0, 0, w, h);
  const key = Math.max(4, Math.round(w * 0.005)); // keyline half-width, from the one spacing scale
  rects.forEach((rect, i) => {
    const panel = state.panels[i] ?? { photo: null, zoom: 1, panX: 0.5, panY: FOCAL_PAN_Y };
    ctx.fillStyle = '#f7f4ec';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    const inner = {
      x: rect.x + key,
      y: rect.y + key,
      w: Math.max(1, rect.w - key * 2),
      h: Math.max(1, rect.h - key * 2),
    };
    drawPanelPhoto(ctx, panel, inner, grade.filter);
    if (state.style === 'gameart' && panel.photo) stylizeGameArt(ctx, inner);
  });
  paintGradeOverlay(ctx, grade, w, h);
  if (state.frame) {
    ctx.strokeStyle = 'rgba(247, 244, 236, 0.9)';
    ctx.lineWidth = Math.max(2, w * 0.003);
    const inset = Math.max(6, w * 0.008);
    ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
  }
  drawCaption(ctx, state, w, h);
  ctx.restore();
}
