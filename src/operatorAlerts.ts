/**
 * Operator lifecycle alerts — cookie/auth + canary failures.
 *
 * Producers emit relay messages on `channel: "operator-alerts"` with the
 * alert details JSON-encoded in `body`. Manual simulation can still POST
 * `event: "operator_alert"` and `alert_category` at the top level. This
 * module formats push payloads and enforces per-category debounce (10 min).
 */

import { config } from './config';
import type { NotificationPayload } from './notifier';

export const ALERT_CATEGORIES = [
  'cookie_expiry_warning',
  'cookie_auth_blocked',
  'cookie_refreshed',
  'canary_failed',
  'credential_request',
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

function parseBodyJson(msg: Record<string, unknown>): Record<string, unknown> | null {
  if (typeof msg.body !== 'string') return null;
  try {
    const parsed: unknown = JSON.parse(msg.body);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // The generic message formatter can still handle non-JSON operator messages.
  }
  return null;
}

function normalizeOperatorAlertMessage(
  msg: Record<string, unknown>,
): Record<string, unknown> | null {
  if (msg.channel === 'operator-alerts') {
    const body = parseBodyJson(msg);
    if (!body) return null;
    return {
      ...msg,
      ...body,
      alert_category: body.alert_category ?? body.category,
    };
  }

  const event = String(msg.event ?? msg.type ?? '');
  if (event !== 'operator_alert') return null;
  return msg;
}

function formatIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString();
}

export function tryBuildOperatorAlertPayload(
  msg: Record<string, unknown>,
): NotificationPayload | null {
  const alertMsg = normalizeOperatorAlertMessage(msg);
  if (!alertMsg) return null;

  const categoryRaw = String(alertMsg.alert_category ?? alertMsg.category ?? '');
  if (!isAlertCategory(categoryRaw)) {
    console.warn(`[operatorAlerts] unknown category: ${categoryRaw}`);
    return null;
  }
  const category = categoryRaw;

  if (isDebounced(debounceKey(category, alertMsg))) {
    console.log(`[operatorAlerts] debounced ${category}`);
    return null;
  }

  switch (category) {
    case 'cookie_expiry_warning': {
      const expiresAt = String(alertMsg.expires_at ?? alertMsg.exp ?? '');
      const mins = alertMsg.minutes_remaining ?? 5;
      return {
        title: 'Cookie expiring soon',
        body: `Cookie expires in ${mins} min — refresh from Console. Expires ${expiresAt ? formatIso(expiresAt) : 'soon'}.`,
        url: consoleUrl('/credentials'),
      };
    }
    case 'cookie_auth_blocked': {
      const agent = String(
        alertMsg.agent_id ?? alertMsg.from_agent_id ?? alertMsg.from_instance_name ?? 'agent',
      );
      const endpoint = String(alertMsg.endpoint ?? alertMsg.path ?? 'unknown endpoint');
      return {
        title: 'Agent blocked on cookie refresh',
        body: `${agent} blocked on cookie refresh: ${endpoint}. Refresh cookie via Console → Deliver Cookie.`,
        url: consoleUrl(
          alertMsg.agent_id
            ? `/agents/${encodeURIComponent(String(alertMsg.agent_id))}`
            : '/fleet',
        ),
      };
    }
    case 'cookie_refreshed': {
      const expiresAt = String(alertMsg.expires_at ?? alertMsg.exp ?? '');
      return {
        title: 'Cookie refreshed',
        body: expiresAt
          ? `Cookie refreshed — expires ${formatIso(expiresAt)}.`
          : 'Cookie refreshed successfully.',
        url: consoleUrl('/credentials'),
      };
    }
    case 'canary_failed': {
      const status = String(alertMsg.status ?? alertMsg.http_status ?? 'error');
      const latencyMs = alertMsg.latency_ms ?? alertMsg.latencyMs ?? alertMsg.latency;
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
    case 'credential_request': {
      const agent = String(
        alertMsg.agent_id ?? alertMsg.from_agent_id ?? alertMsg.from_instance_name ?? 'agent',
      );
      const scope = String(alertMsg.scope ?? alertMsg.credential_type ?? 'credentials');
      const reason = String(alertMsg.reason ?? '').slice(0, 100);
      const mediationPath = String(
        alertMsg.mediation_path ?? '/mediation',
      );
      const reasonSuffix = reason ? `: ${reason}` : '';
      return {
        title: 'Credential request',
        body: `${agent} needs ${scope}${reasonSuffix}`,
        url: consoleUrl(mediationPath),
      };
    }
    default:
      return null;
  }
}
