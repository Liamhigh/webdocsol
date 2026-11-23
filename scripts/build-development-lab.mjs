import { build } from 'esbuild';

// The public page executes the real development contracts against local
// synthetic fixtures. Source modules and tests remain denied by the site
// asset policy; only this browser bundle and its explicitly synthetic page
// are published.
await build({
  entryPoints: ['development/nine-brain-console/browser.js'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'es2020',
  outfile: 'development-lab.js',
  sourcemap: false,
  minify: true,
  legalComments: 'none',
  banner: {
    js: '/* Verum Omnis synthetic development Test Lab; no live provider transport. */'
  }
});
