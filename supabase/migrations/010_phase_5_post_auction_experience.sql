-- 010_PHASE_5_POST_AUCTION_EXPERIENCE.SQL
-- Sets up conversations, messages, notifications, and trigger-driven automation for Phase 5.

-- 1. Create conversations Table
create table if not exists public.conversations (
  id uuid default gen_random_uuid() primary key,
  auction_id uuid not null references public.auctions(id) on delete cascade unique,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  winner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 2. Create messages Table
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null constraint msg_content_length check (length(trim(content)) > 0 and length(content) <= 2000),
  created_at timestamptz default now() not null,
  read_at timestamptz
);

-- 3. Create notifications Table
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('auction_won', 'auction_ended', 'new_message', 'auction_started', 'outbid', 'auction_cancelled')),
  title text not null,
  body text not null,
  auction_id uuid references public.auctions(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  message_id uuid references public.messages(id) on delete cascade,
  is_read boolean default false not null,
  created_at timestamptz default now() not null
);

-- 4. Create Performance Indexes
create index if not exists idx_conversations_auction_id on public.conversations(auction_id);
create index if not exists idx_conversations_seller_id on public.conversations(seller_id);
create index if not exists idx_conversations_winner_id on public.conversations(winner_id);

create index if not exists idx_messages_conversation_id_created on public.messages(conversation_id, created_at desc);
create index if not exists idx_messages_sender_id on public.messages(sender_id);

create index if not exists idx_notifications_user_id_created on public.notifications(user_id, created_at desc);
create index if not exists idx_notifications_user_id_unread on public.notifications(user_id, is_read);

-- 5. Enable Row Level Security (RLS)
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;

-- 6. RLS Policies
-- Conversations Select
drop policy if exists "Allow participants to view conversations" on public.conversations;
create policy "Allow participants to view conversations"
  on public.conversations for select
  using (auth.uid() = seller_id or auth.uid() = winner_id);

-- Messages Select
drop policy if exists "Allow participants to view messages" on public.messages;
create policy "Allow participants to view messages"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (auth.uid() = c.seller_id or auth.uid() = c.winner_id)
    )
  );

-- Notifications Read/Write
drop policy if exists "Allow users to select their own notifications" on public.notifications;
create policy "Allow users to select their own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "Allow users to update their own notifications" on public.notifications;
create policy "Allow users to update their own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

-- 7. Helper Formatting function for Indian Rupees Format (e.g. ₹1,25,000)
create or replace function public.format_indian_currency(val numeric)
returns text as $$
declare
  str text;
begin
  str := to_char(val, 'FM9,99,99,999.00');
  if right(str, 3) = '.00' then
    str := left(str, length(str) - 3);
  end if;
  return str;
end;
$$ language plpgsql;

-- 8. Legacy drop of conflicting RPC functions
drop function if exists public.create_auction_conversation(uuid);
drop function if exists public.send_chat_message(uuid, text);
drop function if exists public.mark_notification_read(uuid);
drop function if exists public.mark_all_notifications_read();

-- 9. secure create_auction_conversation Function
create or replace function public.create_auction_conversation(
  p_auction_id uuid
)
returns uuid as $$
declare
  v_user_id uuid;
  v_auction record;
  v_conv_id uuid;
begin
  -- Require authentication
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required. Please log in.';
  end if;

  -- Lock the auction row
  select * into v_auction
  from public.auctions
  where id = p_auction_id;

  if not found then
    raise exception 'Auction not found.';
  end if;

  -- Verify auction is ended and has a valid winner
  if v_auction.status <> 'ended' or v_auction.winner_id is null then
    raise exception 'Conversations can only be initiated for completed auctions with a winning bidder.';
  end if;

  -- Verify caller is either the seller or the winner
  if v_user_id <> v_auction.seller_id and v_user_id <> v_auction.winner_id then
    raise exception 'Access Denied: You are not authorized to start a conversation for this listing.';
  end if;

  -- Idempotently insert or retrieve conversation
  select id into v_conv_id
  from public.conversations
  where auction_id = p_auction_id;

  if not found then
    insert into public.conversations (auction_id, seller_id, winner_id)
    values (p_auction_id, v_auction.seller_id, v_auction.winner_id)
    returning id into v_conv_id;
  end if;

  return v_conv_id;
end;
$$ language plpgsql security definer;

-- 10. secure send_chat_message Function
create or replace function public.send_chat_message(
  p_conversation_id uuid,
  p_content text
)
returns jsonb as $$
declare
  v_user_id uuid;
  v_conversation record;
  v_message record;
  v_clean_content text;
begin
  -- Require authentication
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required. Please log in.';
  end if;

  -- Fetch and verify conversation
  select * into v_conversation
  from public.conversations
  where id = p_conversation_id;

  if not found then
    raise exception 'Conversation not found.';
  end if;

  -- Verify membership
  if v_user_id <> v_conversation.seller_id and v_user_id <> v_conversation.winner_id then
    raise exception 'Access Denied: You do not belong to this conversation.';
  end if;

  -- Validate and trim content
  v_clean_content := trim(p_content);
  if length(v_clean_content) = 0 then
    raise exception 'Message content cannot be empty.';
  end if;
  if length(v_clean_content) > 2000 then
    raise exception 'Message content exceeds the 2000 character limit.';
  end if;

  -- Insert message
  insert into public.messages (conversation_id, sender_id, content, created_at)
  values (p_conversation_id, v_user_id, v_clean_content, now())
  returning * into v_message;

  -- Update conversation updated_at trigger
  update public.conversations
  set updated_at = now()
  where id = p_conversation_id;

  return to_jsonb(v_message);
end;
$$ language plpgsql security definer;

-- 11. secure Notification Functions
create or replace function public.mark_notification_read(
  p_notification_id uuid
)
returns void as $$
begin
  update public.notifications
  set is_read = true
  where id = p_notification_id and user_id = auth.uid();
end;
$$ language plpgsql security definer;

create or replace function public.mark_all_notifications_read()
returns void as $$
begin
  update public.notifications
  set is_read = true
  where user_id = auth.uid() and is_read = false;
end;
$$ language plpgsql security definer;

-- 12. Trigger Functions
-- Triggers for ended auctions
create or replace function public.handle_auction_ended_notifications()
returns trigger as $$
declare
  v_seller_username text;
  v_winner_username text;
begin
  -- Fetch usernames for personalization
  select username into v_seller_username from public.profiles where id = new.seller_id;
  select username into v_winner_username from public.profiles where id = new.winner_id;

  if new.winner_id is not null then
    -- Winner notification
    insert into public.notifications (user_id, type, title, body, auction_id)
    values (
      new.winner_id,
      'auction_won',
      '🎉 You won an auction!',
      'You won "' || new.title || '" with a bid of ₹' || public.format_indian_currency(new.current_price) || '.',
      new.id
    );

    -- Seller notification
    insert into public.notifications (user_id, type, title, body, auction_id)
    values (
      new.seller_id,
      'auction_ended',
      '📈 Auction completed',
      'Your auction "' || new.title || '" ended with a winning bid of ₹' || public.format_indian_currency(new.current_price) || ' by @' || coalesce(v_winner_username, 'winner') || '.',
      new.id
    );
  else
    -- Seller notification (no bids)
    insert into public.notifications (user_id, type, title, body, auction_id)
    values (
      new.seller_id,
      'auction_ended',
      '📉 Auction ended',
      'Your auction "' || new.title || '" ended without any bids.',
      new.id
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists tr_on_auction_ended on public.auctions;
create trigger tr_on_auction_ended
  after update of status on public.auctions
  for each row
  when (old.status <> 'ended' and new.status = 'ended')
  execute function public.handle_auction_ended_notifications();

-- Triggers for new messages
create or replace function public.handle_new_message_notifications()
returns trigger as $$
declare
  v_conversation record;
  v_recipient_id uuid;
  v_sender_username text;
begin
  -- Find conversation details
  select * into v_conversation from public.conversations where id = new.conversation_id;
  if not found then
    return new;
  end if;

  -- Find recipient
  if new.sender_id = v_conversation.seller_id then
    v_recipient_id := v_conversation.winner_id;
  else
    v_recipient_id := v_conversation.seller_id;
  end if;

  -- Find sender username
  select username into v_sender_username from public.profiles where id = new.sender_id;

  -- Create notification
  insert into public.notifications (user_id, type, title, body, conversation_id, message_id)
  values (
    v_recipient_id,
    'new_message',
    '💬 Message from @' || coalesce(v_sender_username, 'User'),
    case 
      when length(new.content) > 60 then substring(new.content from 1 for 57) || '...'
      else new.content
    end,
    new.conversation_id,
    new.id
  );

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists tr_on_new_message on public.messages;
create trigger tr_on_new_message
  after insert on public.messages
  for each row
  execute function public.handle_new_message_notifications();
