import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) return json({ error: "Não autenticado" }, 401);

    const { data: caller } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).single();
    if (!caller || caller.role !== "admin") {
      return json({ error: "Apenas administradores" }, 403);
    }

    const { user_id, email } = await req.json();
    if (!user_id) return json({ error: "user_id ausente" }, 400);

    const novoEmail = String(email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novoEmail)) {
      return json({ error: "Login inválido" }, 400);
    }

    const { data: target } = await supabaseAdmin.from("profiles").select("id").eq("id", user_id).single();
    if (!target) return json({ error: "Usuário não encontrado" }, 404);

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      email: novoEmail,
      email_confirm: true,
    });
    if (authError) {
      const msg = /already|registered|exists/i.test(authError.message)
        ? "Esse login já está em uso."
        : authError.message;
      return json({ error: msg }, 400);
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ email: novoEmail })
      .eq("id", user_id);
    if (profileError) throw profileError;

    return json({ ok: true, email: novoEmail });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
