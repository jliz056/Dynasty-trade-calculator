import { createClient } from "@supabase/supabase-js";

// Prefer server-side env vars but fall back to Vite client-side vars (VITE_*) when running in the browser
const supabaseUrl = process.env.SUPABASE_URL ?? (typeof import.meta !== 'undefined' ? import.meta.env.VITE_SUPABASE_URL : undefined);
const supabaseKey = process.env.SUPABASE_KEY ?? (typeof import.meta !== 'undefined' ? import.meta.env.VITE_SUPABASE_ANON_KEY : undefined);

function createStubClient() {
  const noOp = async () => ({ data: null, error: null });
  // mimic minimal supabase client surface used in code (from().upsert/select/eq)
  return {
    from() {
      return {
        upsert: noOp,
        select: () => ({ data: null, error: null, single: noOp }),
        eq: () => ({ data: null, error: null, single: noOp }),
      };
    },
  };
}

export const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : createStubClient();

export default supabase; 