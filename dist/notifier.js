"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPushToAll = sendPushToAll;
const web_push_1 = __importDefault(require("web-push"));
const config_1 = require("./config");
const store_1 = require("./store");
web_push_1.default.setVapidDetails(config_1.config.vapidSubject, config_1.config.vapidPublicKey, config_1.config.vapidPrivateKey);
async function sendPushToAll(payload) {
    const subs = (0, store_1.allSubscriptions)();
    if (!subs.length)
        return;
    const results = await Promise.allSettled(subs.map((sub) => web_push_1.default.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload))));
    results.forEach((result, i) => {
        if (result.status === 'rejected') {
            const err = result.reason;
            // 404/410 = subscription expired, remove it
            if (err?.statusCode === 404 || err?.statusCode === 410) {
                console.log(`[notifier] removing expired subscription: ${subs[i].endpoint.slice(-20)}`);
                (0, store_1.removeSubscription)(subs[i].endpoint);
            }
            else {
                console.error(`[notifier] push failed:`, err);
            }
        }
    });
}
