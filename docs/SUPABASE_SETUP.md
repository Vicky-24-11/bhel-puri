# Supabase Setup Guide — Bhel Puri

This document records the database, storage, realtime, and authentication configuration required to host the Bhel Puri backend.

---

## 1. Project Specifications

- **Database Host**: Supabase (PostgreSQL 15+)
- **Region**: South Asia / Mumbai
- **Authentication Mechanism**: Passwordless Email OTP & Google OAuth

---

## 2. Environment Variables (`.env`)

Configure the client variables in a local `.env` file. These variables are exposed to the client-side bundle and must only contain public keys:

```env
# Public Supabase credentials
EXPO_PUBLIC_SUPABASE_URL=https://your-supabase-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-anon-key
```

---

## 3. Deep Linking & Redirect URLs

The application scheme is registered as **`bhelpuri`**. You must whitelist the redirect routes inside your **Supabase Dashboard -> Authentication -> URL Configuration -> Redirect URLs**:

| Platform / Environment  | Redirect URL                                         |
| :---------------------- | :--------------------------------------------------- |
| **Native Production**   | `bhelpuri://auth-callback`                           |
| **Expo Go Development** | `exp://127.0.0.1:8081/--/auth-callback`              |
| **Local Web Client**    | `http://localhost:8081/auth-callback`                |
| **Production Web**      | `https://your-site-domain.netlify.app/auth-callback` |

---

## 4. Authentication Providers Configuration

### A. Email OTP

1.  Go to **Authentication -> Providers -> Email**.
2.  Enable the **Email Provider**.
3.  Ensure **Confirm Email** is enabled (intended for secure OTP delivery).
4.  In the Email Templates, update the **Confirm signup** or **Magic Link** templates to use:
    ```html
    Your 6-digit verification code is: {{ .Token }}
    ```
    This delivers a numeric OTP code instead of a magic link.

### B. Google OAuth

1.  Go to **Authentication -> Providers -> Google**.
2.  Toggle **Google Enable** on.
3.  Provide the Google Client ID and Google Client Secret. (These credentials live securely on Supabase; do not hardcode them in the frontend code).

---

## 5. Database Schema & Migrations

Migrations are applied sequentially under `supabase/migrations/`:

1.  [`001_initial_schema.sql`](file:///Users/vikaspandey/Documents/Bhel%20Puri/supabase/migrations/001_initial_schema.sql): Defines tables `profiles`, `categories`, `products`, `product_images`, `auctions`, `bids`, `watchlists`, `conversations`, `conversation_participants`, `messages`, `notifications`, `ratings`, `reports`.
2.  [`002_rls_policies.sql`](file:///Users/vikaspandey/Documents/Bhel%20Puri/supabase/migrations/002_rls_policies.sql): Restricts write permissions on all app tables based on user credentials.
3.  [`003_auction_functions.sql`](file:///Users/vikaspandey/Documents/Bhel%20Puri/supabase/migrations/003_auction_functions.sql): Declares transactional database procedures.
4.  [`004_update_profiles_schema.sql`](file:///Users/vikaspandey/Documents/Bhel%20Puri/supabase/migrations/004_update_profiles_schema.sql): Alters `profiles` structure (`bio`, `location`, `is_verified`, `is_profile_completed`) and creates buckets (`avatars`, `product-images`) with scoped RLS policies.

---

## 6. Storage Buckets

Two public buckets are required:

- **`avatars`**: Stores user profile photos.
- **`product-images`**: Stores photos for listed products.

**Storage RLS Policies**:

- **Read**: Public read access allowed for anyone (`using (bucket_id = 'avatars')`).
- **Write**: Restricted to authenticated users uploading into a subdirectory named after their user ID (`(storage.foldername(name))[1] = auth.uid()::text`).

---

## 7. Realtime Setup

Enable realtime listeners in the Supabase Dashboard under **Database -> Replication** for:

- `auctions` (instantly updates bidding boards)
- `bids` (streams live bid actions)
- `messages` (pushes instant messaging bubbles)
- `notifications` (streams high-priority user alerts)
