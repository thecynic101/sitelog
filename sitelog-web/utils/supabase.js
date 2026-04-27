import { createClient } from '@supabase/supabase-js';

// We use the service_role key to bypass RLS securely on the server
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
