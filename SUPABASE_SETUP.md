# Supabase Setup Guide — Bhel Puri

This document provides step-by-step instructions to configure your Supabase backend project for the Bhel Puri application.

---

## 1. Create Supabase Project
1.  Go to [Supabase Console](https://supabase.com/) and click **New Project**.
2.  Select an organization and give the project a name (e.g. `Bhel Puri`).
3.  Set a secure database password (save this for future local connections).
4.  Choose the region closest to your target audience and click **Create Project**.

---

## 2. Apply Database Schema and Migrations
Apply the migrations in `supabase/migrations/` sequentially:

### Option A: Via Supabase SQL Editor (e.g., Supabase Web Console)
1.  Open your project dashboard.
2.  Click on the **SQL Editor** tab in the sidebar.
3.  Click **New Query**.
4.  Copy the content of [001_initial_schema.sql](file:///Users/vikaspandey/Documents/Bhel%20Puri/supabase/migrations/001_initial_schema.sql), paste it into the editor, and click **Run**.
5.  Create a second new query, paste the content of [002_rls_policies.sql](file:///Users/vikaspandey/Documents/Bhel%20Puri/supabase/migrations/002_rls_policies.sql), and click **Run**.
6.  Create a third new query, paste the content of [003_auction_functions.sql](file:///Users/vikaspandey/Documents/Bhel%20Puri/supabase/migrations/003_auction_functions.sql), and click **Run**.

### Option B: Via Supabase CLI (Local Dev)
If you have the Supabase CLI installed, link your project and push migrations:
```bash
supabase login
supabase link --project-ref your-project-ref
supabase db push
```

---

## 3. Enable Database Realtime Channels
To display live price changes and chat messages immediately without reloading, enable Realtime for these tables:

1.  In the Supabase Sidebar, go to **Database** -> **Replication**.
2.  Find the row named **supabase_realtime** and click **Edit**.
3.  Toggle on replication for the following tables:
    *   `auctions` (to broadcast updated highest bid and timer end times)
    *   `bids` (to stream new incoming bid amounts)
    *   `messages` (to push instant chat messaging)
    *   `notifications` (to push immediate in-app alerts)

---

## 4. Configure Storage Buckets
The application requires two storage buckets to store images:

1.  Go to **Storage** in the Supabase Sidebar.
2.  Create the following buckets:
    *   `product-images`: Public bucket for auction item photos.
    *   `avatars`: Public bucket for user profile avatars.
3.  Set the bucket access levels to **Public** so anyone can retrieve the image URLs.
4.  Implement RLS policies on Storage:
    *   Allow public read access to all files.
    *   Allow authenticated users to upload files if the folder path matches their user ID (e.g., `product-images/auth.uid()/*`).

---

## 5. Authentication Settings
1.  Navigate to **Authentication** -> **Providers**.
2.  **Email OTP**:
    *   Ensure Email provider is enabled.
    *   (Optional) For OTP verification, toggle **Confirm email** on or configure Custom SMTP for OTP codes.
3.  **Google OAuth**:
    *   Enable Google Provider.
    *   Provide your Client ID and Client Secret from the Google Cloud Console.
    *   Add your Supabase redirect URI to the authorized redirect origins in the Google developer console.
