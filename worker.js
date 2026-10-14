/* Tu Jaane Na // The Parallel Paths — static asset serving only.
   The page is a single self-contained HTML file plus (optionally) the
   accompanying audio track. No server-side logic, no Node runtime. */
export default {
  async fetch(request, env) {
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not found', { status: 404 });
  }
};
