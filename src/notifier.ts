import webPush from 'web-push';
import { config } from './config';
import { allSubscriptions, removeSubscription } from './store';

webPush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey);

export type NotificationPayload = {
  title: string;
  body: string;
  url: string;
};

export async function sendPushToAll(payload: NotificationPayload): Promise<void> {
  const subs = allSubscriptions();
  if (!subs.length) return;

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webPush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        JSON.stringify(payload),
      ),
    ),
  );

  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const err = result.reason as { statusCode?: number };
      // 404/410 = subscription expired, remove it
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        console.log(`[notifier] removing expired subscription: ${subs[i].endpoint.slice(-20)}`);
        removeSubscription(subs[i].endpoint);
      } else {
        console.error(`[notifier] push failed:`, err);
      }
    }
  });
}
