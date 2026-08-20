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

    const { paymentId, amount } = await req.json();
    if (!paymentId || !amount) {
      return new Response(JSON.stringify({ error: "Missing parameters: paymentId and amount are required." }), {
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
    const refundsBlocked = sysConfig?.refunds_blocked_globally || false;

    if (refundsBlocked) {
      await supabaseClient.from("financial_audit_logs").insert({
        actor_id: user.id,
        action: "refund_creation_blocked",
        entity_type: "refund",
        reason: "Refund execution blocked globally by emergency toggle."
      });

      return new Response(JSON.stringify({ error: "Refunds are temporarily suspended." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (env === "production" && !prodEnabled) {
      return new Response(JSON.stringify({ error: "Production refunds are currently unavailable." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Verify user is a Super Admin
    const { data: adminUser } = await supabaseClient
      .from("admin_users")
      .select("role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    const isSuperAdmin = adminUser?.role === "super_admin";
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: "Access Denied: Only Super Admins can issue refunds." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Fetch payment registry record
    const { data: payment, error: pmError } = await supabaseClient
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .single();

    if (pmError || !payment) {
      return new Response(JSON.stringify({ error: "Payment record not found." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Check refund boundary
    const { data: existingRefunds } = await supabaseClient
      .from("payment_refunds")
      .select("amount")
      .eq("payment_id", paymentId)
      .in("status", ["pending", "processed"]);

    const totalRefunded = (existingRefunds || []).reduce((acc: number, r: any) => acc + Number(r.amount), 0);
    if ((totalRefunded + Number(amount)) > Number(payment.amount)) {
      return new Response(JSON.stringify({ error: `Rejected: Refund sum (₹${totalRefunded + Number(amount)}) would exceed captured amount (₹${payment.amount}).` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Configure Cashfree keys and URLs
    let appId, secretKey, cfUrl;
    if (env === "production") {
      appId = Deno.env.get("CASHFREE_PROD_APP_ID") || "";
      secretKey = Deno.env.get("CASHFREE_PROD_SECRET_KEY") || "";
      cfUrl = `https://api.cashfree.com/pg/orders/${payment.id}/refunds`;
    } else {
      appId = Deno.env.get("CASHFREE_SANDBOX_APP_ID") || "TEST1027170134b2203ddb72c9bc44d110717201";
      secretKey = Deno.env.get("CASHFREE_SANDBOX_SECRET_KEY") || "cfsk_ma_test_04c55ec3e7fead17a7e17424b9148560_050d2bc4";
      cfUrl = `https://sandbox.cashfree.com/pg/orders/${payment.id}/refunds`;
    }

    const providerRefundId = `cf_rf_${Date.now()}`;

    // 6. Invoke Cashfree PG Refund API
    let refundStatus = "processed";
    if (appId && secretKey) {
      try {
        const cfResponse = await fetch(cfUrl, {
          method: "POST",
          headers: {
            "x-api-version": "2023-08-01",
            "x-client-id": appId,
            "x-client-secret": secretKey,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            refund_amount: Number(amount),
            refund_id: providerRefundId,
            refund_note: "Bhel Puri Super Admin Refund",
          }),
        });

        if (!cfResponse.ok) {
          const cfData = await cfResponse.json();
          console.warn("Cashfree Refund API warning:", cfData);
          if (env === "production") {
            return new Response(JSON.stringify({ error: cfData.message || "Provider Refund API failed" }), {
              status: cfResponse.status,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      } catch (apiErr) {
        console.error("Cashfree Refund API exception:", apiErr);
        if (env === "production") {
          throw apiErr;
        }
      }
    }

    // 7. Insert refund record
    const { data: refund, error: rfError } = await supabaseClient
      .from("payment_refunds")
      .insert({
        payment_id: paymentId,
        razorpay_refund_id: providerRefundId,
        amount: amount,
        status: refundStatus,
        processed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (rfError) throw rfError;

    // Update payment status to refunded ONLY if fully returned
    const finalRefundTotal = totalRefunded + Number(amount);
    const isFullRefund = finalRefundTotal >= Number(payment.amount);

    if (isFullRefund) {
      await supabaseClient
        .from("payments")
        .update({
          status: "refunded",
          refunded_at: new Date().toISOString()
        })
        .eq("id", paymentId);
    }

    // Log financial audit event
    await supabaseClient
      .from("financial_audit_logs")
      .insert({
        actor_id: user.id,
        action: "refund_processed",
        entity_type: "refund",
        entity_id: refund.id,
        new_value: { paymentId, amount, providerRefundId },
        reason: "Super Admin resolution refund"
      });

    return new Response(JSON.stringify({
      refundId: refund.id,
      cfRefundId: providerRefundId,
      amount: amount,
      status: refundStatus,
      processedAt: refund.processed_at
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Fatal exception in cashfree-refund-create:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
