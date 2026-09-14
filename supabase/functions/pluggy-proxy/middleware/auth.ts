import { createClient, SupabaseClient, User } from "https://esm.sh/@supabase/supabase-js@2.39.8";

export interface AuthContext {
  user: User;
  supabase: SupabaseClient;
  authHeader: string;
  token: Stringish;
}

type Stringish = string;

export async function requireAuth(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) throw Object.assign(new Error("Missing authorization header"), { status: 401 });
  const token = authHeader.split(" ")[1];
  if (!token) throw Object.assign(new Error("Invalid authorization format"), { status: 401 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw Object.assign(new Error("Invalid or expired authentication token"), { status: 401 });

  return { user, supabase, authHeader, token };
}
