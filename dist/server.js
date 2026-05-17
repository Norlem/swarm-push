"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServer = createServer;
const express_1 = __importDefault(require("express"));
const config_1 = require("./config");
const store_1 = require("./store");
function createServer() {
    const app = (0, express_1.default)();
    app.use(express_1.default.json({ limit: '16kb' }));
    // CORS — console origin only
    app.use((req, res, next) => {
        const origin = req.headers.origin;
        if (origin === config_1.config.consoleOrigin) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        }
        if (req.method === 'OPTIONS') {
            res.sendStatus(204);
            return;
        }
        next();
    });
    app.get('/healthz', (_req, res) => {
        res.json({ ok: true });
    });
    // Console fetches this to create a PushManager subscription
    app.get('/vapid-public-key', (_req, res) => {
        res.json({ publicKey: config_1.config.vapidPublicKey });
    });
    // Console POSTs a PushSubscription after subscribing
    app.post('/subscriptions', (req, res) => {
        const { endpoint, keys } = req.body;
        if (!endpoint || !keys?.p256dh || !keys?.auth) {
            res.status(400).json({ error: 'endpoint and keys.p256dh + keys.auth required' });
            return;
        }
        (0, store_1.addSubscription)({ endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } });
        console.log(`[server] subscription added: ${endpoint.slice(-30)}`);
        res.status(201).json({ ok: true });
    });
    // Console sends endpoint to remove a subscription (e.g. on permission revoke)
    app.delete('/subscriptions', (req, res) => {
        const { endpoint } = req.body;
        if (!endpoint) {
            res.status(400).json({ error: 'endpoint required' });
            return;
        }
        (0, store_1.removeSubscription)(endpoint);
        res.json({ ok: true });
    });
    return app;
}
