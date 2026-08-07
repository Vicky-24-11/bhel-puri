# Bhel Puri — The Auction App 🍲🔨

Welcome to **Bhel Puri**, a light, smooth, modern, and trustworthy quick-auction marketplace app. Sellers can list items for short-term auctions, and buyers can discover items, join the live bid streams, bid in real-time, and coordinate product handover through in-app chats upon winning.

This project is built as a production-ready MVP from a single cross-platform codebase supporting **iOS, Android, and Web**.

---

## 🚀 Tech Stack

- **Framework**: [React Native](https://reactnative.dev/) & [Expo](https://expo.dev/) (SDK 57)
- **Routing**: [Expo Router](https://docs.expo.dev/router/introduction/) (File-based navigation)
- **Styling**: [NativeWind (v4)](https://www.nativewind.dev/) (Tailwind CSS for React Native)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Data Fetching**: [TanStack Query](https://tanstack.com/query) (React Query)
- **Form Management**: [React Hook Form](https://react-hook-form.com/) & [Zod](https://zod.dev/) validation
- **Backend Services**: [Supabase](https://supabase.com/) (Auth, PostgreSQL DB, Realtime, RLS Policies)
- **Animations**: [React Native Reanimated](https://docs.expo.dev/versions/latest/sdk/reanimated/)

---

## 📁 Project Folder Structure

We use a clean, **feature-based architecture** under the `src` directory:

```text
├── assets/                  # App images, splash screen, icons
├── supabase/                # Supabase database configurations
│   └── migrations/          # ordered database SQL migrations
└── src/
    ├── app/                 # Expo Router routing directory
    ├── components/          # Reusable shared UI layout components
    │   └── ui/              # Atom level elements (Button, Card, Input...)
    ├── design-system/       # Centralized theme tokens (theme.ts)
    ├── features/            # Feature-specific business logic & UI
    │   ├── auth/            # OTP & Google Sign-In pages
    │   ├── auctions/        # Listing cards, countdowns, bid feeds
    │   ├── chat/            # Post-auction buyer/seller messenger
    │   ├── profile/         # User rating card and creation metrics
    │   └── ...              # Other core capabilities (ratings, reports)
    ├── hooks/               # Custom cross-cutting hooks
    ├── lib/                 # Third-party initializations (supabase.ts)
    ├── services/            # Supabase API access layer
    └── types/               # TypeScript interface and type files
```

---

## 🛠️ Getting Started

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org/) installed (v18+ recommended) and the Expo CLI configured.

### 2. Set Up Environment Variables
Copy `.env.example` to `.env` and fill in your Supabase project parameters:
```bash
cp .env.example .env
```
Modify `.env`:
```text
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-publishable-anon-key
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run the Dev Server
```bash
# Start Metro bundler (supporting all devices)
npx expo start

# Run specifically on target platforms
npm run ios     # Open in iOS Simulator
npm run android # Open in Android Emulator
npm run web     # Open in Web Browser (Localhost)
```

---

## 📚 Technical Documentation

For details on the architecture, setup instructions, and database details, see the following:
*   [ARCHITECTURE.md](file:///Users/vikaspandey/Documents/Bhel%20Puri/ARCHITECTURE.md) - System architecture and component layouts.
*   [SUPABASE_SETUP.md](file:///Users/vikaspandey/Documents/Bhel%20Puri/SUPABASE_SETUP.md) - Setting up Supabase, storage, and SQL migrations.
*   [ENVIRONMENT.md](file:///Users/vikaspandey/Documents/Bhel%20Puri/ENVIRONMENT.md) - App parameters and key settings.
*   [AUCTION_RULES.md](file:///Users/vikaspandey/Documents/Bhel%20Puri/AUCTION_RULES.md) - Authoritative rules engine and anti-sniping rules.
