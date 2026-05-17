"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
function required(name) {
    const v = process.env[name];
    if (!v)
        throw new Error(`Missing required env var: ${name}`);
    return v;
}
exports.config = {
    port: parseInt(process.env.PORT ?? '5200', 10),
    relayUrl: process.env.RELAY_URL ?? 'https://relay.swarm.bdev.norlem.com',
    relayAgentKey: required('RELAY_AGENT_KEY'),
    vapidPublicKey: required('VAPID_PUBLIC_KEY'),
    vapidPrivateKey: required('VAPID_PRIVATE_KEY'),
    vapidSubject: process.env.VAPID_SUBJECT ?? 'mailto:bnorman@norlemtc.com',
    // operator relay identity — messages sent TO this id trigger push
    operatorId: process.env.OPERATOR_ID ?? 'session-primary',
    subscriptionsFile: process.env.SUBSCRIPTIONS_FILE ?? '/opt/swarm-push/subscriptions.json',
    consoleOrigin: process.env.CONSOLE_ORIGIN ?? 'https://console.swarm.bdev.norlem.com',
};
