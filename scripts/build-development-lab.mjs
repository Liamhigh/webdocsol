import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { writeFile } from 'node:fs/promises';

// The public page executes the real development contracts against local
// synthetic fixtures. Source modules and tests remain denied by the site
// asset policy; only this browser bundle and its explicitly synthetic page
// are published.
const result = await build({
  entryPoints: ['development/nine-brain-console/browser.js'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'es2020',
  write: false,
  sourcemap: false,
  minify: true,
  legalComments: 'none',
  banner: {
    js: '/* Verum Omnis synthetic development Test Lab; no live provider transport. */'
  }
});

// Keep the checked-in public asset compact without changing the executed
// module bytes. The wrapper uses only local Blob data: it performs no fetch,
// dynamic module import, eval, provider call or production-route operation.
// Controls stay disabled until the actual IIFE has loaded successfully.
const compressed = gzipSync(result.outputFiles[0].contents, { level: 9, mtime: 0 });
const payload = compressed.toString('base64');
const wrapper = `/* Verum Omnis synthetic development Test Lab; local compressed browser bundle. */
(()=>{const ids=["runBrains","downloadResult","copySummary"];ids.forEach(id=>{document.getElementById(id).disabled=true});function fail(error){const message=document.getElementById("message");message.className="alert";message.textContent="The local Test Lab bundle could not be started: "+error.message;message.classList.remove("hidden")}try{if(typeof DecompressionStream!=="function")throw new Error("this browser does not support local gzip decompression");const bytes=Uint8Array.from(atob("${payload}"),character=>character.charCodeAt(0));new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text().then(source=>{const url=URL.createObjectURL(new Blob([source],{type:"application/javascript"}));const script=document.createElement("script");script.src=url;script.onload=()=>{URL.revokeObjectURL(url);ids.forEach(id=>{document.getElementById(id).disabled=false})};script.onerror=()=>{URL.revokeObjectURL(url);fail(new Error("the local script could not be loaded"))};document.head.appendChild(script)}).catch(fail)}catch(error){fail(error)}})();
`;
await writeFile('development-lab.js', wrapper, 'utf8');
