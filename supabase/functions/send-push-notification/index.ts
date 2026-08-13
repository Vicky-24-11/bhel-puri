// Deno Edge Function to send push notifications using Expo Push API
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.12.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Respond to preflight CORS checks
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    
    // Webhook inserts deliver the notification row inside "record" or directly
    const record = payload.record || payload;
    if (!record || !record.user_id) {
      return new Response(JSON.stringify({ error: "Missing targets configuration." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase Client with service role key to bypass RLS restrictions on server side
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch target user active push tokens
    const { data: tokens, error: tokensErr } = await supabaseClient
      .from("user_push_tokens")
      .select("expo_push_token")
      .eq("user_id", record.user_id)
      .eq("is_active", true);

    if (tokensErr) throw tokensErr;

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ message: "No active push tokens registered for user." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Construct Expo Push Notification messages
    const expoMessages = tokens.map((tokenObj: any) => {
      const dataPayload: any = {
        type: record.type,
        notification_id: record.id,
      };

      if (record.auction_id) dataPayload.auction_id = record.auction_id;
      if (record.conversation_id) dataPayload.conversation_id = record.conversation_id;

      return {
        to: tokenObj.expo_push_token,
        sound: "default",
        title: record.title || "Bhel Puri Notification",
        body: record.body || "",
        data: dataPayload,
      };
    });

    // Send POST requests to Expo Push Notification API
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Accept-encoding": "gzip, deflate",
      },
      body: JSON.stringify(expoMessages),
    });

    const responseText = await response.text();
    console.log(`Expo Push API response: ${responseText}`);

    // Parse response for token cleanup
    try {
      const expoResponse = JSON.parse(responseText);
      if (expoResponse && Array.isArray(expoResponse.data)) {
        for (let i = 0; i < expoResponse.data.length; i++) {
          const res = expoResponse.data[i];
          // DeviceNotRegistered signifies that the token is invalid or the app was uninstalled
          if (res.status === "error" && res.details?.error === "DeviceNotRegistered") {
            const failedToken = expoMessages[i].to;
            await supabaseClient
              .from("user_push_tokens")
              .delete()
              .eq("expo_push_token", failedToken);
            console.log(`Push Monitor: Cleared unregistered token: ${failedToken}`);
          }
        }
      }
    } catch (parseErr) {
      console.warn("Failed to parse Expo response for token cleanup:", parseErr);
    }

    return new Response(JSON.stringify({ success: true, count: expoMessages.length, raw: responseText }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Push Notification Edge Function Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
