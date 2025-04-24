declare module '../../supabaseClient.js' {
  import { SupabaseClient } from '@supabase/supabase-js';
  export const supabase: SupabaseClient;
  export default supabase;
}

declare module '../../../supabaseClient.js' {
  import { SupabaseClient } from '@supabase/supabase-js';
  export const supabase: SupabaseClient;
  export default supabase;
}

declare module '../../../../supabaseClient.js' {
  import { SupabaseClient } from '@supabase/supabase-js';
  export const supabase: SupabaseClient;
  export default supabase;
}

// Declarations without the .js extension (used by some tooling)
declare module '../../supabaseClient' {
  import { SupabaseClient } from '@supabase/supabase-js';
  export const supabase: SupabaseClient;
  export default supabase;
}

declare module '../../../supabaseClient' {
  import { SupabaseClient } from '@supabase/supabase-js';
  export const supabase: SupabaseClient;
  export default supabase;
}

declare module '../../../../supabaseClient' {
  import { SupabaseClient } from '@supabase/supabase-js';
  export const supabase: SupabaseClient;
  export default supabase;
}

// Fallback – match any relative import ending with supabaseClient.js
declare module '*supabaseClient.js' {
  import { SupabaseClient } from '@supabase/supabase-js';
  export const supabase: SupabaseClient;
  export default supabase;
} 