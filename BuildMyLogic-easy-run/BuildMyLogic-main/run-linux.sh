#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$(readlink -f "$0")")"

if ! command -v node >/dev/null 2>&1; then
  echo 'Node.js is missing. Install Node.js 22 LTS or newer, then rerun this script.' >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo 'npm is missing. Install npm with Node.js, then rerun this script.' >&2
  exit 1
fi

node_major="$(node -p 'Number(process.versions.node.split(".")[0])')"
if (( node_major < 22 )); then
  echo "Node.js 22+ is required; detected $(node --version)." >&2
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo 'Installing dependencies (first run only)...'
  npm ci
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo 'Created .env from .env.example. Add your Supabase/Sarvam credentials if you need cloud features.'
fi

echo 'Starting BuildMyLogic web app and local folder-picker bridge...'
npm run dev -- --host 0.0.0.0
