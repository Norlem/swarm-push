import { config } from './config';

const OPERATOR_TO_ROLES = new Set(['operator', 'operator-mediation']);

export function isOperatorMessage(msg: Record<string, unknown>): boolean {
  const to = String(msg.to_agent_id ?? msg.to ?? '');
  if (to === config.operatorId || to === 'primary') return true;
  const toRole = String(msg.to_role ?? '');
  return OPERATOR_TO_ROLES.has(toRole);
}
