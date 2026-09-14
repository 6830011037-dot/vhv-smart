import { httpServerHandler } from 'cloudflare:node';
import { createApp } from './server';

const appPromise = createApp({ cloudflare: true }).then((app) => {
  app.listen(3000);
  return app;
});

export default httpServerHandler({ port: 3000 });

// Keep the app initialization promise referenced so startup failures are visible
// during Worker initialization instead of becoming an unhandled lazy failure.
void appPromise.catch((error) => console.error('[cloudflare] app initialization failed', error));
