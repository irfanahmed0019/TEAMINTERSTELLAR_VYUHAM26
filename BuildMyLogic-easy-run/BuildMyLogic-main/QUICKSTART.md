# BuildMyLogic — Quick start (Linux)

## Requirements
- Node.js 22 LTS or newer
- npm (included with Node.js)
- Internet access for the first dependency install
- Optional desktop folder picker: `zenity` (`sudo apt install zenity`) or `kdialog`

## Run
From the extracted project directory:

```bash
./run-linux.sh
```

Then open the local URL printed by Vite (normally `http://localhost:8080`). Stop with `Ctrl+C`.

Manual alternative:

```bash
npm ci
cp .env.example .env   # only once; edit .env for cloud features
npm run dev
```

## Environment
The app can start without cloud credentials, but authentication, cloud sync, and AI features need the corresponding values in `.env`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only; never expose it with a `VITE_` prefix)
- `SARVAM_API_KEY` (server-side only)

Never commit `.env` or share service-role/API keys.

## VS Code extension
The project contains a newer packaged extension at `public/downloads/buildmylogic-vscode-0.0.4.vsix`. Install it with:

```bash
code --install-extension public/downloads/buildmylogic-vscode-0.0.4.vsix
```

Restart VS Code, open the BuildMyLogic activity-bar view, and connect using an active session ID from the web app. The extension talks to the web app API; it does not need the Sarvam API key.

## Diagnostics
```bash
npm run typecheck
npm run lint
npm run build
```
If installation or any diagnostic fails, copy the complete terminal output. A specific error log is needed to make a reliable source-level fix; do not paste API keys.
