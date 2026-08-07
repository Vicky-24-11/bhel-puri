# Environment Configuration — Bhel Puri

This document details the configuration parameters used by the Bhel Puri frontend app.

---

## 🔑 Environment Variables

The application relies on Expo's built-in support for environment variables. All variables that need to be read in the React Native / Web client **must** be prefixed with `EXPO_PUBLIC_`.

Create a `.env` file in the root directory:

```text
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-publishable-anon-key>
```

### Reference

| Variable | Type | Description | Security |
| :--- | :--- | :--- | :--- |
| `EXPO_PUBLIC_SUPABASE_URL` | String | Your Supabase project URL API gateway. | Client-Safe |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | String | Publishable API token for client database calls. | Client-Safe |

---

## 🔒 Security Policy

> [!WARNING]
> **NEVER** expose the `service_role` key inside client-side code, `.env` file, or source repositories.
> 
> The `service_role` key bypasses Row Level Security and has full admin access to your database. It should only be used in secure backend environments such as Supabase Edge Functions or database triggers.
