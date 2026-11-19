// Fixed scenes for screenshots: ?shot=editor shows the editor with a scene loaded; ?shot=cover shows the
// cover alone, filling the window. The scene is named by query parameters, all optional:
//   photos   comma-separated sample names, placed into the panels in order (default: pier)
//   template collage | triptych | hero        grade  vice | neon | teal | noir | none
//   size     1080x1080 | 1080x1350 | 1920x1080 (the cover's export size)
//   caption, tagline  the words on the cover    pos    top | bottom
//   zoom     one zoom for every panel           zooms  comma-separated zooms, one per panel
//   pans     semicolon-separated "x,y" focal points, one per panel — the shot scenes use these to keep
//            every subject's head inside its panel instead of sliced by the frame edge
// runShot builds the cover state; main.js applies it to the page and paints it.
import { createCoverState, syncPanels, TEMPLATES, GRADES, SIZES } from './cover.js';

export async function runShot(shot, query, loadImage) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const names = (query.get('photos') ?? query.get('photo') ?? 'pier')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);
  const images = [];
  for (const name of names) images.push(await loadImage(`samples/${name}.jpg`));

  const state = createCoverState();
  if (TEMPLATES[query.get('template')]) state.template = query.get('template');
  if (GRADES[query.get('grade')]) state.grade = query.get('grade');
  if (SIZES[query.get('size')]) state.size = query.get('size');
  if (query.get('caption') !== null) state.caption = query.get('caption');
  if (query.get('tagline') !== null) state.tagline = query.get('tagline');
  if (query.get('pos') === 'bottom' || query.get('pos') === 'top') state.captionPos = query.get('pos');
  if (query.get('zoom')) {
    state.panelsZoom = Number(query.get('zoom'));
  }
  syncPanels(state, images);
  const zooms = (query.get('zooms') ?? '').split(',').map((z) => Number(z));
  const pans = (query.get('pans') ?? '').split(';').map((pair) => {
    const [x, y] = pair.split(',').map((v) => Number(v));
    return { x, y };
  });
  state.panels.forEach((panel, i) => {
    panel.photo = images[i % images.length];
    if (state.panelsZoom) panel.zoom = state.panelsZoom;
    if (Number.isFinite(zooms[i]) && zooms[i] > 0) panel.zoom = zooms[i];
    const pan = pans[i];
    if (pan) {
      if (Number.isFinite(pan.x)) panel.panX = Math.min(1, Math.max(0, pan.x));
      if (Number.isFinite(pan.y)) panel.panY = Math.min(1, Math.max(0, pan.y));
    }
  });
  delete state.panelsZoom;
  return state;
}
