import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.12.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user session token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { providerOrderId } = await req.json();
    if (!providerOrderId) {
      return new Response(JSON.stringify({ error: "Missing providerOrderId parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch system safety config
    const { data: sysConfig } = await supabaseClient
      .from("payment_system_config")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    const env = sysConfig?.payment_environment || "sandbox";
    const prodEnabled = sysConfig?.production_payments_enabled || false;
    const providerActive = sysConfig?.provider_activation_status || "pending";

    if (env === "production" && (!prodEnabled || providerActive !== "active")) {
      return new Response(JSON.stringify({ error: "Production verification is currently unavailable." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch current payment registry record
    const { data: payment, error: pmError } = await supabaseClient
      .from("payments")
      .select("*, transaction:transactions(*)")
      .eq("razorpay_order_id", providerOrderId)
      .single();

    if (pmError || !payment) {
      return new Response(JSON.stringify({ error: "Payment record not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Short-circuit if already processed successfully (idempotent verification)
    if (["captured", "held", "released"].includes(payment.status)) {
      return new Response(JSON.stringify({
        paymentId: payment.id,
        cfPaymentId: payment.razorpay_payment_id || `cf_pay_${Date.now()}`,
        status: payment.status,
        amount: payment.amount,
        paidAt: payment.paid_at,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Configure Cashfree keys and URLs
    let appId, secretKey, cfUrl;
    if (env === "production") {
      appId = Deno.env.get("CASHFREE_PROD_APP_ID") || "";
      secretKey = Deno.env.get("CASHFREE_PROD_SECRET_KEY") || "";
      cfUrl = `https://api.cashfree.com/pg/orders/${payment.id}`;
    } else {
      appId = Deno.env.get("CASHFREE_SANDBOX_APP_ID") || "TEST1027170134b2203ddb72c9bc44d110717201";
      secretKey = Deno.env.get("CASHFREE_SANDBOX_SECRET_KEY") || "cfsk_ma_test_04c55ec3e7fead17a7e17424b9148560_050d2bc4";
      cfUrl = `https://sandbox.cashfree.com/pg/orders/${payment.id}`;
    }

    if (!appId || !secretKey) {
      throw new Error(`Missing provider configuration for environment: ${env}`);
    }

    const cfResponse = await fetch(cfUrl, {
      method: "GET",
      headers: {
        "x-api-version": "2023-08-01",
        "x-client-id": appId,
        "x-client-secret": secretKey,
      },
    });

    const cfData = await cfResponse.json();
    if (!cfResponse.ok) {
      console.error("Cashfree order lookup failure:", cfData);
      return new Response(JSON.stringify({ error: cfData.message || "Provider verification failed" }), {
        status: cfResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let nextStatus = payment.status;
    let paidAt = payment.paid_at;
    let heldAt = payment.held_at;

    if (cfData.order_status === "PAID") {
      if (payment.status === "created" || payment.status === "processing" || payment.status === "failed") {
        nextStatus = "held";
        paidAt = new Date().toISOString();
        heldAt = new Date().toISOString();

        const { error: updateError } = await supabaseClient
          .from("payments")
          .update({
            status: nextStatus,
            paid_at: paidAt,
            held_at: heldAt,
            razorpay_payment_id: cfData.cf_payment_id || `cf_pay_${Date.now()}`,
          })
          .eq("id", payment.id);

        if (updateError) throw updateError;

        // Log financial event
        await supabaseClient.from("financial_audit_logs").insert({
          actor_id: user.id,
          action: "payment_captured",
          entity_type: "payment",
          entity_id: payment.id,
          new_value: { status: nextStatus, paidAt }
        });
      }
    } else if (cfData.order_status === "EXPIRED" || cfData.order_status === "TERMINATED") {
      if (payment.status === "created") {
        nextStatus = "failed";
        await supabaseClient.from("payments").update({ status: "failed" }).eq("id", payment.id);
      }
    }

    return new Response(JSON.stringify({
      paymentId: payment.id,
      cfPaymentId: cfData.cf_payment_id || `cf_pay_${Date.now()}`,
      status: nextStatus,
      amount: payment.amount,
      paidAt: paidAt,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Fatal exception in cashfree-payment-verify:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
