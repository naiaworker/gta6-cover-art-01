// Neon Palms Cover Studio — a working gta6-cover-art-01 entry (Node 22, standard library only). The app is this
// directory's app/ folder: plain static files a desktop browser loads fully offline (app/index.html and its ES
// modules, no library and no network request). It turns a person's own photos into a GTA-style poster cover — a
// multi-panel collage with white keylines, a sunset/neon colour grade and a bold Anton caption — and exports it
// as a PNG at 1080 x 1080, 1080 x 1350 or 1920 x 1080. This program hands the entry in: it copies app/ and
// screenshots/ from beside this file to /output and writes /output/dossier.json, the summary the judge reads,
// with the vendored make.fun library. The sample photos (app/samples/) are free to use: two were made for
// make.fun with an image model, one is the owner's own cat.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB of app
// files, in all, or a path under app/ over 1000 bytes: app/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

// A one-line run summary for whoever launched this by hand; the dossier bytes above are the deliverable and
// do not depend on it, so it is wrapped to never fail the run.
try {
  const summary = JSON.parse(dossier);
  console.log(
    `Neon Palms Cover Studio: handed in app/ + screenshots/ to ${out} `
    + `(dossier.json, ${Buffer.byteLength(dossier)} bytes, ${summary.screenshots?.length ?? 0} screenshots).`,
  );
} catch {
  console.log(`Neon Palms Cover Studio: handed in app/ + screenshots/ to ${out}.`);
}
