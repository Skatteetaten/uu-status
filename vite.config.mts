/// <reference types="vite/client" />
import { createReadStream, existsSync, cpSync } from 'node:fs';
import { join, normalize, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const DOCS = join(rootDir, 'docs');

/**
 * Datafilene bygges av Python-skriptene og ligger i docs/ – der de må bli,
 * fordi build_uu_archive.py leser baseline via `git show HEAD:docs/...` og
 * fordi UU-portalen henter uu-status-details.json fra den publiserte stien.
 *
 * Denne pluginen serverer dem under dev og kopierer dem inn i bygget, slik at
 * appen kan bruke de samme relative stiene som i produksjon.
 */
function erDatasti(url: string): boolean {
  return url === '/uu-status-details.json' || url.startsWith('/data/');
}

function uuData(): Plugin {
  return {
    name: 'uu-status-data',

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0];
        if (!erDatasti(url)) {
          return next();
        }
        // Normaliser bort ../ så vi ikke serverer utenfor docs/.
        const rel = normalize(decodeURIComponent(url)).replace(/^[\\/]+/, '');
        const file = join(DOCS, rel);
        if (!file.startsWith(DOCS) || !existsSync(file)) {
          return next();
        }
        res.setHeader(
          'Content-Type',
          extname(file) === '.jsonl' ? 'text/plain' : 'application/json'
        );
        res.setHeader('Cache-Control', 'no-store');
        createReadStream(file).pipe(res);
      });
    },

    closeBundle() {
      const out = join(rootDir, 'dist');
      cpSync(
        join(DOCS, 'uu-status-details.json'),
        join(out, 'uu-status-details.json')
      );
      cpSync(join(DOCS, 'data'), join(out, 'data'), {
        recursive: true,
        // skatteetaten-source.json er 2,1 MB råspeil som bare Python leser.
        // Den ble publisert uten at appen noen gang hentet den.
        filter: (src) => !src.endsWith('skatteetaten-source.json'),
      });
    },
  };
}

/**
 * Content-Security-Policy, satt som meta fordi GitHub Pages ikke kan sette
 * HTTP-hoder.
 *
 * Injiseres bare i bygget: utviklingsserveren kjører et inline-skript for
 * HMR, og en `script-src 'self'` i HTML-kilden ville stoppet `npm run dev`.
 *
 * `style-src` må tillate 'unsafe-inline' fordi Ringdiagram og Stolpediagram
 * setter farge og bredde via style-attributtet. `frame-ancestors` virker ikke
 * i meta – den krever et HTTP-hode, og kan ikke settes på GitHub Pages.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

function csp(): Plugin {
  return {
    name: 'uu-status-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`
      );
    },
  };
}

export default defineConfig({
  root: 'app',
  publicDir: false,
  // Relativ base. Siden ligger på skatteetaten.github.io/uu-status/, og med
  // standardverdien '/' pekte script- og lenketaggene på /assets/… – altså
  // roten av github.io, ikke prosjektet. Siden ville lastet blankt.
  // Datafilene hentes allerede med relative stier av samme grunn.
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    // Flersides-app, ikke SPA. GitHub Pages har ingen rewrites, og
    // UU-portalen lenker direkte til uu-status.html – filnavnene må bestå.
    rollupOptions: {
      input: {
        // index.html ER statusoversikten. uu-status.html blir liggende som en
        // viderekobling hit, fordi URL-en er offentlig og lenket til utenfra.
        status: resolve(rootDir, 'app/index.html'),
        statusOmdirigering: resolve(rootDir, 'app/uu-status.html'),
        arkiv: resolve(rootDir, 'app/uu-arkiv.html'),
        benchmark: resolve(rootDir, 'app/benchmark.html'),
      },
    },
  },
  server: { port: 3001, host: 'localhost' },
  plugins: [react(), uuData(), csp()],
});
