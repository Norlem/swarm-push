/**
 * Relay SSE watcher — subscribes to the unscoped relay event stream and fires
 * push notifications for any message addressed to the operator (session-primary).
 */

import { config } from './config';
import { sendPushToAll } from './notifier';
import { tryBuildOperatorAlertPayload } from './operatorAlerts';

const RELAY_SSE_URL = `${config.relayUrl}/api/events`;
const PREVIEW_MAX = 120;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function extractDataPayload(block: string): string | null {
  let acc = '';
  for (const line of block.split('\n')) {
    if (line.startsWith('data:')) acc += line.slice(5).trimStart();
  }
  const t = acc.trim();
  return t.length ? t : null;
}

function parseMessage(data: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(data);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item && typeof item === 'object') return item as Record<string, unknown>;
      }
    }
  } catch { /* ignore */ }
  return null;
}

function isOperatorMessage(msg: Record<string, unknown>): boolean {
  const to = String(msg.to_agent_id ?? msg.to ?? '');
  return to === config.operatorId || to === 'primary';
}

function buildPayload(msg: Record<string, unknown>) {
  const sender = String(msg.from_instance_name ?? msg.from ?? msg.from_agent_id ?? 'Agent');
  const body = String(msg.body ?? '').slice(0, PREVIEW_MAX);
  const fromId = String(msg.from_agent_id ?? '');
  return {
    title: `Message from ${sender}`,
    body: body.length < String(msg.body ?? '').length ? body + '…' : body,
    url: fromId
      ? `https://console.swarm.bdev.norlem.com/agents/${encodeURIComponent(fromId)}`
      : 'https://console.swarm.bdev.norlem.com',
  };
}

async function consumeStream(): Promise<void> {
  const ctrl = new AbortController();
  const response = await fetch(RELAY_SSE_URL, {
    headers: { 'X-Agent-Key': config.relayAgentKey, accept: 'text/event-stream' },
    signal: ctrl.signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`relay_sse_${response.status}`);
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const chunks = buffer.split(/\n\n/);
      buffer = chunks.pop() ?? '';
      for (const block of chunks) {
        if (!block.trim() || block.startsWith(':')) continue;
        const data = extractDataPayload(block);
        if (!data || (!data.startsWith('{') && !data.startsWith('['))) continue;
        const msg = parseMessage(data);
        if (!msg) continue;
        if (msg.event === 'agent_heartbeat' || msg.type === 'agent_heartbeat') continue;
        if (isOperatorMessage(msg)) {
          const payload =
            tryBuildOperatorAlertPayload(msg) ?? buildPayload(msg);
          console.log(`[watcher] → push: "${payload.title}" | "${payload.body}"`);
          void sendPushToAll(payload);
        }
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}

export async function startWatcher(): Promise<void> {
  let backoffMs = 2000;
  console.log(`[watcher] starting — relay: ${RELAY_SSE_URL}`);
  for (;;) {
    try {
      await consumeStream();
      backoffMs = 2000;
    } catch (err) {
      console.error(`[watcher] stream error, reconnecting in ${backoffMs}ms:`, err);
    }
    await sleep(backoffMs);
    backoffMs = Math.min(Math.round(backoffMs * 1.7), 30_000);
  }
}
