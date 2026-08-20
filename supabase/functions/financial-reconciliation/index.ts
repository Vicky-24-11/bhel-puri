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
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch payments created in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: payments, error: pmtsError } = await supabaseClient
      .from("payments")
      .select("*, transaction:transactions(*)")
      .gte("created_at", thirtyDaysAgo.toISOString());

    if (pmtsError) {
      throw pmtsError;
    }

    let checked = 0;
    let matched = 0;
    let mismatched = 0;
    let newIssues = 0;
    let alreadyTracked = 0;

    for (const payment of (payments || [])) {
      checked++;

      // Query Cashfree status/data (Simulated sandbox lookup for provider comparisons)
      const providerAmount = payment.amount;
      const providerStatus = payment.status === "processing" ? "captured" : payment.status;

      let hasMismatch = false;
      let issueType = "";

      if (Number(payment.amount) !== Number(providerAmount)) {
        hasMismatch = true;
        issueType = "amount_mismatch";
      } else if (payment.status !== providerStatus) {
        hasMismatch = true;
        issueType = "status_mismatch";
      }

      if (hasMismatch) {
        mismatched++;
        // Check if issue is already tracked
        const { data: existingIssue } = await supabaseClient
          .from("financial_reconciliation_issues")
          .select("id")
          .eq("payment_id", payment.id)
          .eq("issue_type", issueType)
          .maybeSingle();

        if (existingIssue) {
          alreadyTracked++;
        } else {
          newIssues++;
          await supabaseClient
            .from("financial_reconciliation_issues")
            .insert({
              payment_id: payment.id,
              transaction_id: payment.transaction_id,
              issue_type: issueType,
              internal_amount: payment.amount,
              provider_amount: providerAmount,
              internal_status: payment.status,
              provider_status: providerStatus,
              metadata: { source: "scheduled_reconciliation_job" },
              resolution_status: "open"
            });
        }
      } else {
        matched++;
      }
    }

    const summary = {
      checked,
      matched,
      mismatched,
      newIssues,
      alreadyTracked
    };

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Fatal error in scheduled reconciliation:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
