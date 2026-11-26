import { createClient } from '@supabase/supabase-js';

export interface NewBroadcast {
  storeId: string;
  arrivalSummary: string;
  photoUrl: string | null;
  featuredIds: string[];
}

export interface BroadcastSummary {
  broadcastId: string;
  arrivalSummary: string;
  photoUrl: string | null;
  featuredIds: string[];
  postedAt: string;
}

export interface PushSubscriptionJson {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushTarget {
  userId: string;
  subscriptions: PushSubscriptionJson[];
}

export interface BroadcastRepository {
  /** Inserts the broadcast; `posted_at` is set by the database. */
  create(broadcast: NewBroadcast): Promise<BroadcastSummary>;
  /** Newest first. */
  listForStore(storeId: string, limit: number): Promise<BroadcastSummary[]>;
  /** The subset of `ids` that are saved master records. */
  existingRecordIds(ids: string[]): Promise<string[]>;
  pushTargets(storeId: string): Promise<PushTarget[]>;
  saveSubscription(userId: string, subscription: PushSubscriptionJson): Promise<void>;
  /** Without a user, removes the endpoint from every account (dead subscription). */
  removeSubscription(endpoint: string, userId?: string): Promise<void>;
}

interface Row {
  broadcast_id: string;
  arrival_summary: string;
  photo_url: string | null;
  featured_ids: string[] | null;
  posted_at: string;
}

const COLUMNS = 'broadcast_id, arrival_summary, photo_url, featured_ids, posted_at';

const toSummary = (r: Row): BroadcastSummary => ({
  broadcastId: r.broadcast_id,
  arrivalSummary: r.arrival_summary,
  photoUrl: r.photo_url,
  featuredIds: r.featured_ids ?? [],
  postedAt: r.posted_at,
});

export function supabaseBroadcasts(url: string, serviceRoleKey: string): BroadcastRepository {
  const db = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  return {
    async create(b) {
      const { data, error } = await db
        .from('merchant_broadcasts')
        .insert({
          store_id: b.storeId,
          arrival_summary: b.arrivalSummary,
          photo_url: b.photoUrl,
          featured_ids: b.featuredIds,
        })
        .select(COLUMNS)
        .single();
      if (error) throw error;
      return toSummary(data as Row);
    },

    async listForStore(storeId, limit) {
      const { data, error } = await db
        .from('merchant_broadcasts')
        .select(COLUMNS)
        .eq('store_id', storeId)
        .order('posted_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data as Row[]).map(toSummary);
    },

    async existingRecordIds(ids) {
      if (ids.length === 0) return [];
      const { data, error } = await db
        .from('master_records')
        .select('record_id')
        .in('record_id', ids);
      if (error) throw error;
      return (data as { record_id: string }[]).map((r) => r.record_id);
    },

    async pushTargets(storeId) {
      const { data, error } = await db.rpc('broadcast_push_targets', { p_store_id: storeId });
      if (error) throw error;
      return (data as { user_id: string; subscriptions: PushSubscriptionJson[] }[]).map((r) => ({
        userId: r.user_id,
        subscriptions: r.subscriptions,
      }));
    },

    async saveSubscription(userId, subscription) {
      const { error } = await db.rpc('save_push_subscription', {
        p_user_id: userId,
        p_subscription: subscription,
      });
      if (error) throw error;
    },

    async removeSubscription(endpoint, userId) {
      const { error } = await db.rpc('remove_push_subscription', {
        p_endpoint: endpoint,
        p_user_id: userId ?? null,
      });
      if (error) throw error;
    },
  };
}
