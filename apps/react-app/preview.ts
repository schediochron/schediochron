/**
 * Serves the production build, standing in for `vite preview`.
 * Playwright drives this — run `bun run build` first.
 */
const dist = new URL('./dist/', import.meta.url);
const port = Number(process.env['PORT'] ?? 4300);

Bun.serve({
  port,
  async fetch(req) {
    const { pathname } = new URL(req.url);
    const asset = Bun.file(new URL(`.${pathname}`, dist));

    // Unknown paths fall through to index.html so client-side routes resolve.
    if (pathname !== '/' && (await asset.exists())) return new Response(asset);
    return new Response(Bun.file(new URL('./index.html', dist)), {
      headers: { 'content-type': 'text/html' },
    });
  },
});

console.log(`preview running at http://localhost:${port}`);
