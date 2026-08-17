const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://nmwtpozrywbkgekugqzd.supabase.co';
const supabaseKey = 'sb_publishable_udCoQISXdMw4bHUIwyQSFw_exIPEN0i';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Testing query 1...');
  const res1 = await supabase
    .from('auctions')
    .select('*, seller:profiles!auctions_seller_id_fkey(username, full_name), winner:profiles!auctions_winner_id_fkey(username)');
  console.log('Query 1 Error:', res1.error);
  console.log('Query 1 Data length:', res1.data ? res1.data.length : null);

  console.log('\nTesting query 2 (transactions)...');
  const res2 = await supabase
    .from('transactions')
    .select('*, seller:profiles!transactions_seller_id_fkey(username), buyer:profiles!transactions_buyer_id_fkey(username), auction:auctions(title)');
  console.log('Query 2 Error:', res2.error);
  console.log('Query 2 Data length:', res2.data ? res2.data.length : null);
}

run();
