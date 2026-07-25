/**
 * verumglobal-static — the Worker dedicated to serving the public website.
 *
 * It reverse-proxies every request to the Cloudflare Pages project holding the
 * site. The proxy logic lives in ./static-proxy.js so this Worker and the
 * fallback inside worker/verum-rules.js can never drift apart.
 *
 * Recovered from the deployed Worker, which had no source in version control.
 * This file is the source of truth from now on.
 */

import { serveStatic } from './static-proxy.js';

export default {
  async fetch(request) {
    return serveStatic(request);
  },
};
