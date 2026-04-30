# U'rWay Popup (React)

This folder contains a Vite + React app used as the extension popup.

Quick commands:

- Install dependencies: npm install
- Run dev server (for development): npm run dev
- Build production bundle: npm run build

After building, set the extension popup to `popup_react/dist/index.html` (manifest.json already updated by the assistant).

Notes:
- The React app fetches encrypted activities from the bridge URL (`VITE_BRIDGE_URL`, default `http://localhost:5002`) and attempts to decrypt them using the registration timestamp (via `CryptoUtils`).
- Ensure you run `python urway_bridge.py` while testing so data is available.
