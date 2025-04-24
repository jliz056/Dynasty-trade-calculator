import { supabase } from '../../supabaseClient.js';
import type { AuthUser } from './auth.js';

export interface PlayerStats {
  position: string;
  ppg: number;
  yards: number;
  td: number;
  snap_pct: number;
  rushing_att: number;
  targets?: number;
  receptions?: number;
  passing?: {
    yards: number;
    touchdowns: number;
    interceptions: number;
  };
  rushing?: {
    yards: number;
    touchdowns: number;
  };
  receiving?: {
    yards: number;
    touchdowns: number;
    targets?: number;
  };
}

export interface Player {
  name: string;
  value: number;
  stats: PlayerStats;
}

export interface TradeSide {
  players: Player[];
  picks: string[];
}

export interface Trade {
  id?: string;
  userId: string;
  title: string;
  sideA: TradeSide;
  sideB: TradeSide;
  totalValueA: number;
  totalValueB: number;
  createdAt: Date;
  isPublic: boolean;
  league?: {
    name: string;
    scoring?: string;
    format?: string;
    size?: number;
  };
}

// Helper to obtain current user (client side)
const getCurrentUser = async (): Promise<AuthUser | null> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user
    ? ({
        id: user.id,
        email: user.email ?? undefined,
        displayName: user.user_metadata?.full_name ?? undefined,
        photoURL: user.user_metadata?.avatar_url ?? undefined,
      } as AuthUser)
    : null;
};

const convertTimestamp = (value: any): Date => new Date(value);

// Save a new trade
export const saveTrade = async (
  trade: Omit<Trade, 'id' | 'userId' | 'createdAt'>,
): Promise<Trade> => {
  const user = await getCurrentUser();
  if (!user) throw new Error('You must be logged in to save a trade');

  const insertData: any = {
    ...trade,
    user_id: user.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('trades').insert(insertData).select('*').single();
  if (error) {
    throw new Error(error.message || 'Failed to save trade');
  }

  return {
    id: data.id,
    userId: data.user_id,
    title: data.title,
    sideA: data.side_a,
    sideB: data.side_b,
    totalValueA: Number(data.total_value_a),
    totalValueB: Number(data.total_value_b),
    createdAt: convertTimestamp(data.created_at),
    isPublic: data.is_public,
    league: data.league ?? undefined,
  };
};

// Get a specific trade by ID
export const getTrade = async (tradeId: string): Promise<Trade> => {
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('id', tradeId)
    .single();
  if (error || !data) throw new Error(error?.message || 'Trade not found');

  return {
    id: data.id,
    userId: data.user_id,
    title: data.title,
    sideA: data.side_a,
    sideB: data.side_b,
    totalValueA: Number(data.total_value_a),
    totalValueB: Number(data.total_value_b),
    createdAt: convertTimestamp(data.created_at),
    isPublic: data.is_public,
    league: data.league ?? undefined,
  };
};

// Get all trades for the current user
export const getUserTrades = async (): Promise<Trade[]> => {
  const user = await getCurrentUser();
  if (!user) throw new Error('You must be logged in to view your trades');

  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message || 'Failed to get trades');

  return (data ?? []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    title: row.title,
    sideA: row.side_a,
    sideB: row.side_b,
    totalValueA: Number(row.total_value_a),
    totalValueB: Number(row.total_value_b),
    createdAt: convertTimestamp(row.created_at),
    isPublic: row.is_public,
    league: row.league ?? undefined,
  }));
};

// Get public trades for the community
export const getPublicTrades = async (limit = 10): Promise<Trade[]> => {
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message || 'Failed to get public trades');
  return (data ?? []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    title: row.title,
    sideA: row.side_a,
    sideB: row.side_b,
    totalValueA: Number(row.total_value_a),
    totalValueB: Number(row.total_value_b),
    createdAt: convertTimestamp(row.created_at),
    isPublic: row.is_public,
    league: row.league ?? undefined,
  }));
};

// Update an existing trade
export const updateTrade = async (
  tradeId: string,
  tradeData: Partial<Trade>,
): Promise<void> => {
  const user = await getCurrentUser();
  if (!user) throw new Error('You must be logged in to update a trade');

  const { data: existing, error: fetchErr } = await supabase
    .from('trades')
    .select('user_id')
    .eq('id', tradeId)
    .single();
  if (fetchErr || !existing) throw new Error('Trade not found');
  if (existing.user_id !== user.id) throw new Error('You can only update your own trades');

  const { id, userId, createdAt, ...updatableData } = tradeData as any;

  const { error } = await supabase
    .from('trades')
    .update({ ...updatableData, updated_at: new Date().toISOString() })
    .eq('id', tradeId);
  if (error) throw new Error(error.message || 'Failed to update trade');
};

// Delete a trade
export const deleteTrade = async (tradeId: string): Promise<void> => {
  const user = await getCurrentUser();
  if (!user) throw new Error('You must be logged in to delete a trade');

  const { data: existing, error: fetchErr } = await supabase
    .from('trades')
    .select('user_id')
    .eq('id', tradeId)
    .single();
  if (fetchErr || !existing) throw new Error('Trade not found');
  if (existing.user_id !== user.id) throw new Error('You can only delete your own trades');

  const { error } = await supabase.from('trades').delete().eq('id', tradeId);
  if (error) throw new Error(error.message || 'Failed to delete trade');
}; 