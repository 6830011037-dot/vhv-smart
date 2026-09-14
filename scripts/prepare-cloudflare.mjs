import { cp, mkdir, rm } from 'node:fs/promises';

const patientDist = new URL('../patient-access/dist/', import.meta.url);
const target = new URL('../dist/patient-view/', import.meta.url);

await mkdir(target, { recursive: true });
await cp(patientDist, target, { recursive: true });

// The Worker entrypoint is separate from the static asset bundle. Never publish
// the Node server bundle as a browser-accessible asset.
await rm(new URL('../dist/server.cjs', import.meta.url), { force: true });
await rm(new URL('../dist/server.cjs.map', import.meta.url), { force: true });

console.log('Cloudflare static assets prepared: dist/ + dist/patient-view/');
