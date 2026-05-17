import { config } from './config';
import { createServer } from './server';
import { startWatcher } from './watcher';

const app = createServer();

app.listen(config.port, () => {
  console.log(`[swarm-push] listening on :${config.port}`);
});

// Start relay SSE watcher in background
startWatcher().catch((err) => {
  console.error('[swarm-push] watcher fatal error:', err);
  process.exit(1);
});
