import webpush from 'web-push';
import type { BroadcastRepository, PushSubscriptionJson } from './repository.js';

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

export interface PushSender {
  publicKey: string;
  /** Resolves with the push service's HTTP status; rejects on network errors. */
  send(subscription: PushSubscriptionJson, payload: PushPayload): Promise<number>;
}

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

const TTL_SECONDS = 60 * 60;

export function webPushSender(vapid: VapidConfig): PushSender {
  return {
    publicKey: vapid.publicKey,
    async send(subscription, payload) {
      try {
        const res = await webpush.sendNotification(subscription, JSON.stringify(payload), {
          TTL: TTL_SECONDS,
          urgency: 'normal',
          vapidDetails: vapid,
        });
        return res.statusCode;
      } catch (err) {
        if (err instanceof webpush.WebPushError) return err.statusCode;
        throw err;
      }
    },
  };
}

const BATCH = 50;

export interface NotifyResult {
  sent: number;
  removed: number;
  failed: number;
}

/**
 * Notifies opted-in collectors near (or favoriting) the store about a broadcast.
 * Subscriptions the push service reports as gone (404/410) are deleted.
 */
export async function notifyBroadcast(
  repo: BroadcastRepository,
  sender: PushSender,
  broadcast: { broadcastId: string; storeId: string; businessName: string; arrivalSummary: string },
): Promise<NotifyResult> {
  const targets = await repo.pushTargets(broadcast.storeId);
  const subscriptions = targets.flatMap((t) => t.subscriptions);
  const summary = broadcast.arrivalSummary;
  const payload: PushPayload = {
    title: `New arrivals at ${broadcast.businessName}`,
    body: summary.length > 140 ? `${summary.slice(0, 139)}…` : summary,
    url: `/broadcasts/${broadcast.broadcastId}`,
    tag: `broadcast-${broadcast.broadcastId}`,
  };
  const result: NotifyResult = { sent: 0, removed: 0, failed: 0 };
  for (let i = 0; i < subscriptions.length; i += BATCH) {
    const batch = subscriptions.slice(i, i + BATCH);
    const outcomes = await Promise.allSettled(batch.map((s) => sender.send(s, payload)));
    await Promise.all(
      outcomes.map(async (o, j) => {
        if (o.status === 'fulfilled' && o.value >= 200 && o.value < 300) {
          result.sent++;
        } else if (o.status === 'fulfilled' && (o.value === 404 || o.value === 410)) {
          result.removed++;
          await repo.removeSubscription(batch[j]!.endpoint);
        } else {
          result.failed++;
        }
      }),
    );
  }
  return result;
}
