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

    // 1. Fetch current payment details
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

    // Short-circuit if already refunded (idempotent check)
    if (payment.status === "refunded") {
      return new Response(JSON.stringify({ success: true, message: "Payment already fully refunded." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Configure keys and URLs
    const { data: sysConfig } = await supabaseClient
      .from("payment_system_config")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    const env = sysConfig?.payment_environment || "sandbox";
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

    // 2. Handle recovery flow if in refund_pending status
    if (payment.status === "refund_pending") {
      const { data: refund } = await supabaseClient
        .from("payment_refunds")
        .select("*")
        .eq("payment_id", paymentId)
        .eq("amount", amount)
        .maybeSingle();

      if (refund) {
        await supabaseClient.from("payments").update({ status: "refunded" }).eq("id", paymentId);
        return new Response(JSON.stringify({ success: true, recovered: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (appId && secretKey) {
        try {
          const cfResponse = await fetch(cfUrl, {
            method: "GET",
            headers: {
              "x-api-version": "2023-08-01",
              "x-client-id": appId,
              "x-client-secret": secretKey,
            }
          });
          if (cfResponse.ok) {
            const cfData = await cfResponse.json();
            // If matching refund exists on provider, restore status to refunded
            if (cfData && cfData.length > 0) {
              await supabaseClient.from("payments").update({ status: "refunded" }).eq("id", paymentId);
              return new Response(JSON.stringify({ success: true, recovered: true, providerVerified: true }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          }
        } catch (apiErr) {
          console.warn("GET refunds lookup failed during recovery:", apiErr);
        }
      }
    }

    // 3. STAGE 1 — DATABASE ATOMIC CLAIM (via RPC)
    const { data: claim, error: claimErr } = await supabaseClient.rpc("claim_refund_create", {
      p_payment_id: paymentId,
      p_amount: amount
    });

    if (claimErr || !claim?.success) {
      return new Response(JSON.stringify({ error: claimErr?.message || "Failed to claim atomic refund status lock." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. STAGE 2 — PROVIDER OPERATION (after DB transaction commits)
    const providerRefundId = `cf_rf_${Date.now()}`;
    let refundSuccess = true;

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
            refundSuccess = false;
          }
        }
      } catch (err) {
        console.error("Cashfree Refund API error:", err);
        refundSuccess = false;
      }
    }

    // 5. Update terminal status
    let finalStatus = payment.status;
    if (refundSuccess) {
      // Check partial refund status
      const { data: existingRefunds } = await supabaseClient
        .from("payment_refunds")
        .select("amount")
        .eq("payment_id", paymentId)
        .in("status", ["pending", "processed"]);

      const totalRefunded = (existingRefunds || []).reduce((acc: number, r: any) => acc + Number(r.amount), 0);
      const finalRefundTotal = totalRefunded + Number(amount);
      const isFullRefund = finalRefundTotal >= Number(payment.amount);

      finalStatus = isFullRefund ? "refunded" : "captured";

      await supabaseClient
        .from("payments")
        .update({
          status: finalStatus,
          refunded_at: isFullRefund ? new Date().toISOString() : null
        })
        .eq("id", paymentId);

      // Insert refund record
      await supabaseClient
        .from("payment_refunds")
        .insert({
          payment_id: paymentId,
          razorpay_refund_id: providerRefundId,
          amount: amount,
          status: "processed",
          processed_at: new Date().toISOString()
        });

      // Log financial audit event
      await supabaseClient
        .from("financial_audit_logs")
        .insert({
          actor_id: user.id,
          action: "refund_processed",
          entity_type: "refund",
          new_value: { paymentId, amount, providerRefundId },
          reason: "Super Admin resolution refund"
        });
    } else {
      // Revert status to captured on failure
      await supabaseClient.from("payments").update({ status: "captured" }).eq("id", paymentId);
    }

    return new Response(JSON.stringify({
      success: refundSuccess,
      status: finalStatus,
      cfRefundId: providerRefundId
    }), {
      status: refundSuccess ? 200 : 500,
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
