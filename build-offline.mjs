import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = file => readFile(path.join(root, file), 'utf8');
const bundleOptions = { absWorkingDir: root, bundle: true, write: false, minify: true,
  format: 'iife', platform: 'browser', target: 'es2020', legalComments: 'inline' };
const worker = (await build({ ...bundleOptions, entryPoints: ['src/ai/AimWorker.ts'] })).outputFiles[0].text;
const music = 'data:audio/mpeg;base64,' + (await readFile(path.join(root, 'assets/audio/outer-space-loop.mp3'))).toString('base64');
function replaceExactlyOnce(source, before, after) {
  if (source.split(before).length !== 2) throw new Error('Offline build source changed: ' + before);
  return source.replace(before, () => after);
}
const result = await build({ ...bundleOptions, entryPoints: ['src/main.ts'],
  define: { 'import.meta.env.DEV': 'false', 'import.meta.env.VITE_GAME_PLATFORM': '"playtest"' },
  loader: { '.css': 'empty' },
  plugins: [{ name: 'embed-local-assets', setup(builder) {
    builder.onLoad({ filter: /TrajectoryPlanner\.ts$/ }, async args => ({ loader: 'ts',
      contents: replaceExactlyOnce(await readFile(args.path, 'utf8'),
        "new Worker(new URL('./AimWorker.ts', import.meta.url), { type: 'module' })",
        `(() => { const url = URL.createObjectURL(new Blob([${JSON.stringify(worker)}], { type: 'text/javascript' }));
          try { const worker = new Worker(url); URL.revokeObjectURL(url); return worker; }
          catch (error) { URL.revokeObjectURL(url); throw error; } })()`)
    }));
    builder.onLoad({ filter: /rendering[\\/]Music\.ts$/ }, async args => ({ loader: 'ts',
      contents: replaceExactlyOnce(await readFile(args.path, 'utf8'),
        "new URL('../../assets/audio/outer-space-loop.mp3', import.meta.url).href", JSON.stringify(music))
    }));
  } }]
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = await read('src/style.css');
const icon = 'data:image/svg+xml;base64,' + (await readFile(path.join(root, 'public/favicon.svg'))).toString('base64');
const notices = (await read('public/THIRD-PARTY-NOTICES.txt')).replace(/-->/g, '-- >');
let html = await read('index.html');
html = html.replace('href="./favicon.svg"', `href="${icon}"`)
  .replace('</head>', `<style>${css}</style></head>`)
  .replace('<script type="module" src="/src/main.ts"></script>', () => `<script>${js}</script>`)
  .replace('</html>', `<!--\n${notices}\n--></html>`);
if (/<script[^>]+\bsrc=|<link[^>]+href=["'](?!data:)|type="module"/.test(html)) throw new Error('Offline HTML still has external resources');
const output = path.join(root, 'Play-Gravity-Duel.html');
await writeFile(output, html, 'utf8');
console.log(`Offline playable file: ${output} (${Buffer.byteLength(html)} bytes)`);
