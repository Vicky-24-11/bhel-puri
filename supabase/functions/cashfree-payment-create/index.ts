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

    const { transactionId } = await req.json();
    if (!transactionId) {
      return new Response(JSON.stringify({ error: "Missing transactionId parameter" }), {
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
    const paymentsBlocked = sysConfig?.payments_blocked_globally || false;

    if (paymentsBlocked) {
      await supabaseClient.from("financial_audit_logs").insert({
        actor_id: user.id,
        action: "payment_creation_blocked",
        entity_type: "payment",
        reason: "Payment creation blocked globally by emergency toggle."
      });

      return new Response(JSON.stringify({ error: "Payments are temporarily suspended." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (env === "production" && !prodEnabled) {
      await supabaseClient.from("financial_audit_logs").insert({
        actor_id: user.id,
        action: "production_payment_blocked",
        entity_type: "payment",
        reason: "Attempted production checkout but safety switch is off."
      });

      return new Response(JSON.stringify({ error: "Production payments are currently unavailable." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch transaction details
    const { data: transaction, error: txError } = await supabaseClient
      .from("transactions")
      .select("*, buyer:profiles!transactions_buyer_id_fkey(*), seller:profiles!transactions_seller_id_fkey(*)")
      .eq("id", transactionId)
      .single();

    if (txError || !transaction) {
      return new Response(JSON.stringify({ error: "Transaction record not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Security validation
    if (transaction.buyer_id !== user.id) {
      return new Response(JSON.stringify({ error: "Access Denied: Only the transaction buyer can pay." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Status eligibility check
    if (transaction.status !== "pending" && transaction.status !== "contacted") {
      return new Response(JSON.stringify({ error: "Transaction is not eligible for payment" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Check if payment already exists
    const { data: existingPayment } = await supabaseClient
      .from("payments")
      .select("*")
      .eq("transaction_id", transactionId)
      .maybeSingle();

    if (existingPayment && ["captured", "held", "released"].includes(existingPayment.status)) {
      return new Response(JSON.stringify({ error: "Payment already successfully captured for this transaction" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Configure keys
    let appId, secretKey, cfUrl, cfGetUrl;
    if (env === "production") {
      appId = Deno.env.get("CASHFREE_PROD_APP_ID") || "";
      secretKey = Deno.env.get("CASHFREE_PROD_SECRET_KEY") || "";
      cfUrl = "https://api.cashfree.com/pg/orders";
    } else {
      appId = Deno.env.get("CASHFREE_SANDBOX_APP_ID") || "TEST1027170134b2203ddb72c9bc44d110717201";
      secretKey = Deno.env.get("CASHFREE_SANDBOX_SECRET_KEY") || "cfsk_ma_test_04c55ec3e7fead17a7e17424b9148560_050d2bc4";
      cfUrl = "https://sandbox.cashfree.com/pg/orders";
    }

    if (!appId || !secretKey) {
      throw new Error(`Missing App ID or Secret Key configuration for environment: ${env}`);
    }

    // 6. Reuse existing checkout session if active
    if (existingPayment && existingPayment.razorpay_order_id) {
      cfGetUrl = `${cfUrl}/${existingPayment.id}`;
      try {
        const getResponse = await fetch(cfGetUrl, {
          method: "GET",
          headers: {
            "x-api-version": "2023-08-01",
            "x-client-id": appId,
            "x-client-secret": secretKey,
            "content-type": "application/json",
          }
        });
        if (getResponse.ok) {
          const getData = await getResponse.json();
          return new Response(JSON.stringify({
            paymentId: existingPayment.id,
            cfOrderId: existingPayment.razorpay_order_id,
            paymentLink: getData.payment_session_id,
            amount: existingPayment.amount,
            currency: "INR",
            status: existingPayment.status,
          }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (getErr) {
        console.warn("GET order details failed, creating a new checkout flow:", getErr);
      }
    }

    // 7. Insert or update payments record
    const { data: payment, error: pmError } = await supabaseClient
      .from("payments")
      .upsert({
        transaction_id: transactionId,
        amount: transaction.amount,
        currency: "INR",
        provider: "cashfree",
        status: "created",
      }, { onConflict: "transaction_id" })
      .select()
      .single();

    if (pmError || !payment) {
      throw pmError || new Error("Failed to register payments record.");
    }

    // 8. Create Cashfree checkout order
    const cfResponse = await fetch(cfUrl, {
      method: "POST",
      headers: {
        "x-api-version": "2023-08-01",
        "x-client-id": appId,
        "x-client-secret": secretKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        order_id: payment.id,
        order_amount: payment.amount,
        order_currency: "INR",
        customer_details: {
          customer_id: transaction.buyer_id,
          customer_phone: "9999999999",
          customer_email: transaction.buyer?.email || "buyer@bhelpuri.com",
        },
        order_meta: {
          return_url: `exp://127.0.0.1:19000/--/payment-callback?order_id=${payment.id}`,
        },
      }),
    });

    const cfData = await cfResponse.json();
    if (!cfResponse.ok) {
      console.error("Cashfree order creation failure:", cfData);
      return new Response(JSON.stringify({ error: cfData.message || "Provider API creation failed" }), {
        status: cfResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 9. Update payments with order ID
    await supabaseClient
      .from("payments")
      .update({
        razorpay_order_id: cfData.cf_order_id,
        status: "created",
      })
      .eq("id", payment.id);

    // Audit log insertion
    await supabaseClient.from("financial_audit_logs").insert({
      actor_id: user.id,
      action: "payment_initiated",
      entity_type: "payment",
      entity_id: payment.id,
      new_value: { cfOrderId: cfData.cf_order_id, amount: payment.amount }
    });

    return new Response(JSON.stringify({
      paymentId: payment.id,
      cfOrderId: cfData.cf_order_id,
      paymentLink: cfData.payment_session_id,
      amount: payment.amount,
      currency: "INR",
      status: "created",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Fatal exception in cashfree-payment-create:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
