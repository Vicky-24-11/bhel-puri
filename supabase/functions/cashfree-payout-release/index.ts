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

    const { paymentId } = await req.json();
    if (!paymentId) {
      return new Response(JSON.stringify({ error: "Missing paymentId parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch current payment details
    const { data: payment, error: pmError } = await supabaseClient
      .from("payments")
      .select("*, transaction:transactions(*)")
      .eq("id", paymentId)
      .single();

    if (pmError || !payment) {
      return new Response(JSON.stringify({ error: "Payment record not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isBuyer = payment.transaction?.buyer_id === user.id;

    // 2. Short-circuit if already processed successfully (idempotent)
    if (payment.status === "released") {
      return new Response(JSON.stringify({ success: true, message: "Payout already released." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Configure Cashfree keys and URLs
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
      cfUrl = `https://api.cashfree.com/pg/orders/${payment.id}/splits`;
    } else {
      appId = Deno.env.get("CASHFREE_SANDBOX_APP_ID") || "TEST1027170134b2203ddb72c9bc44d110717201";
      secretKey = Deno.env.get("CASHFREE_SANDBOX_SECRET_KEY") || "cfsk_ma_test_04c55ec3e7fead17a7e17424b9148560_050d2bc4";
      cfUrl = `https://sandbox.cashfree.com/pg/orders/${payment.id}/splits`;
    }

    // 4. Handle recovery flow if in release_pending status
    if (payment.status === "release_pending") {
      // Check if transfer is already logged internally
      const { data: transfer } = await supabaseClient
        .from("payment_transfers")
        .select("*")
        .eq("payment_id", paymentId)
        .maybeSingle();

      if (transfer) {
        // Recover state
        await supabaseClient.from("payments").update({ status: "released" }).eq("id", paymentId);
        return new Response(JSON.stringify({ success: true, recovered: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check provider details
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
            // If split details exist on provider, transition to released
            if (cfData && cfData.length > 0) {
              await supabaseClient.from("payments").update({ status: "released" }).eq("id", paymentId);
              return new Response(JSON.stringify({ success: true, recovered: true, providerVerified: true }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          }
        } catch (apiErr) {
          console.warn("GET splits lookup failed during recovery checks:", apiErr);
        }
      }
    }

    // 5. STAGE 1 — DATABASE ATOMIC CLAIM (via RPC)
    const { data: claim, error: claimErr } = await supabaseClient.rpc("claim_payout_release", {
      p_payment_id: paymentId,
      p_actor_id: user.id
    });

    if (claimErr || !claim?.success) {
      return new Response(JSON.stringify({ error: claimErr?.message || "Failed to claim atomic payout status lock." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. STAGE 2 — PROVIDER OPERATION (after DB transaction commits)
    const sellerOnboardingId = `acct_${payment.transaction?.seller_id.slice(0, 8)}`;
    const providerTransferId = `cf_tr_${Date.now()}`;

    let payoutSuccess = true;
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
          body: JSON.stringify([
            {
              vendorId: sellerOnboardingId,
              amount: Number(payment.seller_payable_amount)
            }
          ]),
        });

        if (!cfResponse.ok) {
          const cfData = await cfResponse.json();
          console.warn("Cashfree Split API warning:", cfData);
          if (env === "production") {
            payoutSuccess = false;
          }
        }
      } catch (err) {
        console.error("Cashfree Split API error:", err);
        payoutSuccess = false;
      }
    }

    // 7. Update terminal status
    const finalStatus = payoutSuccess ? "released" : "failed";
    await supabaseClient
      .from("payments")
      .update({
        status: finalStatus,
        released_at: payoutSuccess ? new Date().toISOString() : null
      })
      .eq("id", paymentId);

    if (payoutSuccess) {
      // Create transfer details
      await supabaseClient
        .from("payment_transfers")
        .insert({
          payment_id: paymentId,
          razorpay_transfer_id: providerTransferId,
          linked_account_id: sellerOnboardingId,
          amount: payment.seller_payable_amount,
          status: "processed",
          settlement_on_hold: false,
          processed_at: new Date().toISOString(),
          settled_at: new Date().toISOString()
        });

      // Log financial audit event
      await supabaseClient
        .from("financial_audit_logs")
        .insert({
          actor_id: user.id,
          action: "payout_released",
          entity_type: "payment",
          entity_id: paymentId,
          new_value: { paymentId, released: true },
          reason: isBuyer ? "Buyer confirmed receipt" : "Super Admin released payout"
        });
    }

    return new Response(JSON.stringify({ success: payoutSuccess, status: finalStatus }), {
      status: payoutSuccess ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Fatal exception in cashfree-payout-release:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
