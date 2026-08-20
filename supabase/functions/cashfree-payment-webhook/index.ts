import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.12.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cf-signature, x-cf-timestamp",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get("x-cf-signature");
    const timestamp = req.headers.get("x-cf-timestamp");
    const rawBody = await req.text();

    if (!signature || !timestamp) {
      console.warn("Webhook request missing signature headers");
      return new Response(JSON.stringify({ error: "Missing signature headers" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch system config to resolve environment and secrets
    const { data: sysConfig } = await supabaseClient
      .from("payment_system_config")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    const env = sysConfig?.payment_environment || "sandbox";

    let webhookSecret;
    if (env === "production") {
      webhookSecret = Deno.env.get("CASHFREE_PROD_WEBHOOK_SECRET");
    } else {
      webhookSecret = Deno.env.get("CASHFREE_SANDBOX_WEBHOOK_SECRET") || "cf_webhook_secret_sandbox_placeholder_12345";
    }

    if (!webhookSecret) {
      throw new Error(`Webhook secret not configured for environment: ${env}`);
    }

    // 2. Verify Cashfree Webhook Signature
    const verified = await verifyWebhookSignature(signature, timestamp, rawBody, webhookSecret);
    if (!verified) {
      console.warn("Invalid webhook signature verified");
      return new Response(JSON.stringify({ error: "Signature verification failed" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload.event;
    const orderData = payload.data?.order;
    const paymentData = payload.data?.payment;

    if (!orderData || !orderData.order_id) {
      return new Response(JSON.stringify({ message: "Invalid payload: missing order details" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Unique event ID for idempotency checks
    const cfEventId = payload.event_time + "_" + orderData.order_id + "_" + (paymentData?.cf_payment_id || "");

    // 3. Insert event for webhook idempotency
    const { error: insertError } = await supabaseClient
      .from("payment_webhook_events")
      .insert({
        razorpay_event_id: cfEventId,
        event_type: eventType,
        payload: payload,
        processed: true,
        processed_at: new Date().toISOString()
      });

    if (insertError) {
      if (insertError.code === "23505") {
        console.log(`Duplicate webhook event: ${cfEventId} - Ignored safely.`);
        return new Response(JSON.stringify({ message: "Duplicate event logged. Ignored." }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw insertError;
    }

    // 4. Process the webhook transaction state changes
    const { data: payment, error: pmError } = await supabaseClient
      .from("payments")
      .select("*")
      .eq("id", orderData.order_id)
      .single();

    if (pmError || !payment) {
      console.warn(`Payment registry record not found for Order ID: ${orderData.order_id}`);
      return new Response(JSON.stringify({ message: "Processed event log. No payment mapping found." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (eventType === "ORDER_PAID") {
      if (payment.status === "created" || payment.status === "processing") {
        const { error: updateError } = await supabaseClient
          .from("payments")
          .update({
            status: "held",
            paid_at: new Date().toISOString(),
            held_at: new Date().toISOString(),
            razorpay_payment_id: paymentData?.cf_payment_id || `cf_pay_${Date.now()}`
          })
          .eq("id", payment.id);

        if (updateError) throw updateError;
        console.log(`Payment status updated to 'held' for Order: ${payment.id}`);
      }
    } else if (eventType === "ORDER_FAILED") {
      if (payment.status === "created") {
        await supabaseClient.from("payments").update({ status: "failed" }).eq("id", payment.id);
        console.log(`Payment status updated to 'failed' for Order: ${payment.id}`);
      }
    }

    return new Response(JSON.stringify({ success: true, processedEventId: cfEventId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Fatal exception in cashfree-payment-webhook:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function verifyWebhookSignature(signature: string, timestamp: string, rawBody: string, secret: string): Promise<boolean> {
  const payload = timestamp + rawBody;
  const encoder = new TextEncoder();
  const keyBuf = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBuf,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const payloadBuf = encoder.encode(payload);
  const signatureBuf = await crypto.subtle.sign("HMAC", key, payloadBuf);
  
  const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuf)));
  return base64Signature === signature;
}
