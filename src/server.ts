import express, { Request, Response, NextFunction } from 'express';
import { config } from './config';
import { addSubscription, removeSubscription } from './store';

export function createServer(): express.Application {
  const app = express();

  app.use(express.json({ limit: '16kb' }));

  // CORS — console origin only
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin === config.consoleOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
  });

  app.get('/healthz', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // Console fetches this to create a PushManager subscription
  app.get('/vapid-public-key', (_req: Request, res: Response) => {
    res.json({ publicKey: config.vapidPublicKey });
  });

  // Console POSTs a PushSubscription after subscribing
  app.post('/subscriptions', (req: Request, res: Response) => {
    const { endpoint, keys } = req.body as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      res.status(400).json({ error: 'endpoint and keys.p256dh + keys.auth required' });
      return;
    }
    addSubscription({ endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } });
    console.log(`[server] subscription added: ${endpoint.slice(-30)}`);
    res.status(201).json({ ok: true });
  });

  // Console sends endpoint to remove a subscription (e.g. on permission revoke)
  app.delete('/subscriptions', (req: Request, res: Response) => {
    const { endpoint } = req.body as { endpoint?: string };
    if (!endpoint) { res.status(400).json({ error: 'endpoint required' }); return; }
    removeSubscription(endpoint);
    res.json({ ok: true });
  });

  return app;
}
