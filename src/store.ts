import fs from 'fs';
import path from 'path';
import { config } from './config';

export type PushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  addedAt: string;
};

function load(): Map<string, PushSubscription> {
  try {
    const raw = fs.readFileSync(config.subscriptionsFile, 'utf8');
    const arr: PushSubscription[] = JSON.parse(raw);
    return new Map(arr.map((s) => [s.endpoint, s]));
  } catch {
    return new Map();
  }
}

function save(map: Map<string, PushSubscription>): void {
  const dir = path.dirname(config.subscriptionsFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(config.subscriptionsFile, JSON.stringify([...map.values()], null, 2));
}

let _store = load();

export function addSubscription(sub: Omit<PushSubscription, 'addedAt'>): void {
  _store.set(sub.endpoint, { ...sub, addedAt: new Date().toISOString() });
  save(_store);
}

export function removeSubscription(endpoint: string): void {
  _store.delete(endpoint);
  save(_store);
}

export function allSubscriptions(): PushSubscription[] {
  return [..._store.values()];
}
