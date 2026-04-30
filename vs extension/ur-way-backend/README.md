# urway-backend

Minimal backend to support Google OAuth sign-in and exchange for the VS Code extension.

Setup

1. Copy `.env.example` to `.env` and fill values (`MONGO_URI`, `DB_NAME`, Google client id/secret).
2. Install deps:

```bash
npm install
```

3. Run server:

```bash
npm start
```

Google OAuth setup

- Create an OAuth client in Google Cloud Console.
- Add redirect URI: `http://localhost:3000/auth/google/callback`
- Fill credentials in `.env`.

Flow

- Open `http://localhost:3000/auth/google` to start sign-in.
- After consent the page will display a short one-time code to paste back into the extension.
- The extension calls `POST /auth/exchange` with the code to receive the user id/email.
