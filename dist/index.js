"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const server_1 = require("./server");
const watcher_1 = require("./watcher");
const app = (0, server_1.createServer)();
app.listen(config_1.config.port, () => {
    console.log(`[swarm-push] listening on :${config_1.config.port}`);
});
// Start relay SSE watcher in background
(0, watcher_1.startWatcher)().catch((err) => {
    console.error('[swarm-push] watcher fatal error:', err);
    process.exit(1);
});
