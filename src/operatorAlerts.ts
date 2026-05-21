/**
 * Operator lifecycle alerts — cookie/auth + canary failures.
 *
 * Producers POST relay messages with `event: "operator_alert"` and
 * `alert_category` (see docs/operator-alerts.md). This module formats
 * push payloads and enforces per-category debounce (10 min).
 */

import { config } from './config';
import type { NotificationPayload } from './notifier';

export const ALERT_CATEGORIES = [
  'cookie_expiry_warning',
  'cookie_auth_blocked',
  'cookie_refreshed',
  'canary_failed',
] as const;

export type AlertCategory = (typeof ALERT_CATEGORIES)[number];

const DEBOUNCE_MS = 10 * 60 * 1000;
const lastSentAt = new Map<string, number>();

function consoleUrl(path: string): string {
  const base = config.consoleOrigin.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function debounceKey(category: AlertCategory, msg: Record<string, unknown>): string {
  if (category === 'cookie_auth_blocked') {
    const agent = String(msg.agent_id ?? msg.from_agent_id ?? 'unknown');
    return `${category}:${agent}`;
  }
  return category;
}

function isDebounced(key: string): boolean {
  const now = Date.now();
  const prev = lastSentAt.get(key);
  if (prev !== undefined && now - prev < DEBOUNCE_MS) return true;
  lastSentAt.set(key, now);
  return false;
}

function isAlertCategory(v: string): v is AlertCategory {
  return (ALERT_CATEGORIES as readonly string[]).includes(v);
}

function formatIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString();
}

export function tryBuildOperatorAlertPayload(
  msg: Record<string, unknown>,
): NotificationPayload | null {
  const event = String(msg.event ?? msg.type ?? '');
  if (event !== 'operator_alert') return null;

  const categoryRaw = String(msg.alert_category ?? msg.category ?? '');
  if (!isAlertCategory(categoryRaw)) {
    console.warn(`[operatorAlerts] unknown category: ${categoryRaw}`);
    return null;
  }
  const category = categoryRaw;

  if (isDebounced(debounceKey(category, msg))) {
    console.log(`[operatorAlerts] debounced ${category}`);
    return null;
  }

  switch (category) {
    case 'cookie_expiry_warning': {
      const expiresAt = String(msg.expires_at ?? msg.exp ?? '');
      const mins = msg.minutes_remaining ?? 5;
      return {
        title: 'Cookie expiring soon',
        body: `Cookie expires in ${mins} min — refresh from Console. Expires ${expiresAt ? formatIso(expiresAt) : 'soon'}.`,
        url: consoleUrl('/credentials'),
      };
    }
    case 'cookie_auth_blocked': {
      const agent = String(
        msg.agent_id ?? msg.from_agent_id ?? msg.from_instance_name ?? 'agent',
      );
      const endpoint = String(msg.endpoint ?? msg.path ?? 'unknown endpoint');
      return {
        title: 'Agent blocked on cookie refresh',
        body: `${agent} blocked on cookie refresh: ${endpoint}. Refresh cookie via Console → Deliver Cookie.`,
        url: consoleUrl(
          msg.agent_id
            ? `/agents/${encodeURIComponent(String(msg.agent_id))}`
            : '/fleet',
        ),
      };
    }
    case 'cookie_refreshed': {
      const expiresAt = String(msg.expires_at ?? msg.exp ?? '');
      return {
        title: 'Cookie refreshed',
        body: expiresAt
          ? `Cookie refreshed — expires ${formatIso(expiresAt)}.`
          : 'Cookie refreshed successfully.',
        url: consoleUrl('/credentials'),
      };
    }
    case 'canary_failed': {
      const status = String(msg.status ?? msg.http_status ?? 'error');
      const latencyMs = msg.latency_ms ?? msg.latencyMs ?? msg.latency;
      const latency =
        latencyMs !== undefined && latencyMs !== ''
          ? ` / latency ${latencyMs}ms`
          : '';
      return {
        title: 'Budget canary FAILED',
        body: `Canary FAILED: ${status}${latency}. Check budget providers in Console.`,
        url: consoleUrl('/budget'),
      };
    }
    default:
      return null;
  }
}
