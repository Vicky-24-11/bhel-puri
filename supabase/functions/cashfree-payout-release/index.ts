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

    // 1. Fetch system safety config
    const { data: sysConfig } = await supabaseClient
      .from("payment_system_config")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    const env = sysConfig?.payment_environment || "sandbox";
    const prodEnabled = sysConfig?.production_payments_enabled || false;

    if (env === "production" && !prodEnabled) {
      return new Response(JSON.stringify({ error: "Production payouts are currently unavailable." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch admin status
    const { data: adminUser } = await supabaseClient
      .from("admin_users")
      .select("role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    const isSuperAdmin = adminUser?.role === "super_admin";

    // 3. Fetch payment details
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

    if (!isSuperAdmin && !isBuyer) {
      return new Response(JSON.stringify({ error: "Access Denied: Unauthorized to confirm receipt." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Status checks
    if (payment.status !== "held" && payment.status !== "captured") {
      return new Response(JSON.stringify({ error: "Payment is not in hold/captured status." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check active disputes
    const { data: activeDisputes } = await supabaseClient
      .from("disputes")
      .select("id")
      .eq("transaction_id", payment.transaction_id)
      .in("status", ["open", "under_review"]);

    if (activeDisputes && activeDisputes.length > 0) {
      return new Response(JSON.stringify({ error: "Blocked: An active dispute is open on this transaction." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Query seller onboarding account KYC/eligibility details
    const { data: sellerAccount } = await supabaseClient
      .from("payment_provider_accounts")
      .select("*")
      .eq("user_id", payment.transaction.seller_id)
      .maybeSingle();

    if (env === "production") {
      if (!sellerAccount || sellerAccount.kyc_status !== "verified" || !sellerAccount.payout_enabled) {
        return new Response(JSON.stringify({ error: "Blocked: Seller payouts are disabled due to incomplete verification/KYC status." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 6. Update status and release in database (simulated sandbox release)
    const { error: updateError } = await supabaseClient
      .from("payments")
      .update({
        status: "released",
        released_at: new Date().toISOString()
      })
      .eq("id", paymentId);

    if (updateError) throw updateError;

    // Create a payout transfer record
    await supabaseClient
      .from("payment_transfers")
      .insert({
        payment_id: paymentId,
        razorpay_transfer_id: `cf_tr_${Date.now()}`,
        linked_account_id: sellerAccount?.provider_account_id || `acct_${payment.transaction?.seller_id.slice(0, 8)}`,
        amount: payment.seller_payable_amount,
        status: "processed",
        settlement_on_hold: false,
        processed_at: new Date().toISOString(),
        settled_at: new Date().toISOString()
      });

    // Write audit event
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

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
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
