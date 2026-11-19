// Fixed scenes for screenshots: ?shot=editor shows the editor with a scene loaded; ?shot=cover shows the
// cover alone, filling the window. The scene is named by query parameters, all optional:
//   photos   comma-separated sample names, placed into the panels in order (default: pier)
//   template collage | triptych | hero        grade  vice | neon | teal | noir | none
//   size     1080x1080 | 1080x1350 | 1920x1080 (the cover's export size)
//   caption, tagline  the words on the cover    pos    top | bottom
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
  state.panels.forEach((panel, i) => {
    panel.photo = images[i % images.length];
    if (state.panelsZoom) panel.zoom = state.panelsZoom;
  });
  delete state.panelsZoom;
  return state;
}
