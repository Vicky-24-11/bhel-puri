const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://nmwtpozrywbkgekugqzd.supabase.co';
const supabaseKey = 'sb_publishable_udCoQISXdMw4bHUIwyQSFw_exIPEN0i';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
  console.log('--- STARTING PAYMENTS & FINANCIAL SECURITY VERIFICATION ---');

  // Test 1: Anonymous Read payments
  try {
    const { data, error } = await supabase.from('payments').select('*');
    if (error) {
      console.log('Test 1 (Anon SELECT payments): PASS (Blocked with error:', error.message, ')');
    } else {
      console.log('Test 1 (Anon SELECT payments): FAIL (Allowed to read', data.length, 'rows)');
    }
  } catch (err) {
    console.log('Test 1 (Anon SELECT payments): PASS (Exception blocked)');
  }

  // Test 2: Client INSERT payment
  try {
    const { data, error } = await supabase.from('payments').insert({
      transaction_id: '00000000-0000-0000-0000-000000000000',
      amount: 1000,
      status: 'created'
    });
    if (error) {
      console.log('Test 2 (Client INSERT payment): PASS (Blocked with error:', error.message, ')');
    } else {
      console.log('Test 2 (Client INSERT payment): FAIL (Allowed to insert:', data, ')');
    }
  } catch (err) {
    console.log('Test 2 (Client INSERT payment): PASS (Exception blocked)');
  }

  // Test 3: Client WRITE platform_fee_config
  try {
    const { data, error } = await supabase.from('platform_fee_config').insert({
      commission_rate: 10.00,
      is_active: true
    });
    if (error) {
      console.log('Test 3 (Client INSERT platform_fee_config): PASS (Blocked with error:', error.message, ')');
    } else {
      console.log('Test 3 (Client INSERT platform_fee_config): FAIL (Allowed to insert:', data, ')');
    }
  } catch (err) {
    console.log('Test 3 (Client INSERT platform_fee_config): PASS (Exception blocked)');
  }

  // Test 4: Client SELECT financial_audit_logs
  try {
    const { data, error } = await supabase.from('financial_audit_logs').select('*');
    if (error) {
      console.log('Test 4 (Client SELECT financial_audit_logs): PASS (Blocked with error:', error.message, ')');
    } else {
      console.log('Test 4 (Client SELECT financial_audit_logs): FAIL (Allowed to read', data.length, 'rows)');
    }
  } catch (err) {
    console.log('Test 4 (Client SELECT financial_audit_logs): PASS (Exception blocked)');
  }

  console.log('--- PAYMENTS & FINANCIAL SECURITY VERIFICATION COMPLETE ---');
}

runTests();
