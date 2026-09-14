import 'dotenv/config';
import path from 'node:path';
import express from 'express';
import bodyParser from 'body-parser';
import { createServer as createViteServer } from 'vite';
import { createApp } from './server';

async function start() {
  const app = await createApp({ jsonParser: bodyParser.json({ limit: '15mb' }) });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    const patientAccessDistPath = path.join(process.cwd(), 'patient-access', 'dist');
    app.use('/patient-view', express.static(patientAccessDistPath));
    app.get('/patient-view/*', (_req, res) => res.sendFile(path.join(patientAccessDistPath, 'index.html')));
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
