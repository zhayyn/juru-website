/** Keep all browser development traffic behind the authenticated HTTP middleware. */
export async function createDevelopmentServer() {
  // Import only on the development path; production startup does not require Vite.
  const { createServer } = await import('vite');
  return createServer({
    server: { middlewareMode: true, ws: false, hmr: false },
    appType: 'spa',
  });
}
