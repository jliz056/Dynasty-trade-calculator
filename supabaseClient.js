import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

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