#!/usr/bin/env bash
#
# Delete every voice in the ElevenLabs account whose key is stored in .env.local
#
# Usage:
# /opt/homebrew/bin/bash ./delete_all_voices.sh
#
#   ENV_FILE=/custom/path/.env ./delete_all_voices.sh
#
# Requires:
#   - curl
#   - jq   (brew install jq | sudo apt-get install jq)

set -euo pipefail

# ---------- locate & source the env file ----------
ENV_FILE="${ENV_FILE:-$(dirname "$0")/.env.local}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌  Could not find $ENV_FILE"
  echo "    Set ENV_FILE=/path/to/.env.local or create one."
  exit 1
fi

# shellcheck source=/dev/null
set -a           # export everything we source
source "$ENV_FILE"
set +a
# ---------------------------------------------------

API_KEY="${ELEVENLABS_API_KEY:-}"
if [[ -z "$API_KEY" ]]; then
  echo "❌  ELEVENLABS_API_KEY not set in $ENV_FILE"
  exit 1
fi

BASE_URL="https://api.elevenlabs.io"
LIST_URL="$BASE_URL/v2/voices"
DELETE_URL="$BASE_URL/v1/voices"   # /{voice_id}

echo "🔍  Fetching voice list…"
voices_json="$(curl -s -H "xi-api-key: $API_KEY" "$LIST_URL")"

mapfile -t voice_ids < <(echo "$voices_json" | jq -r '.voices[].voice_id')

if (( ${#voice_ids[@]} == 0 )); then
  echo "ℹ️   No voices found – nothing to delete."
  exit 0
fi

echo "🗑   Deleting ${#voice_ids[@]} voice(s)…"
for id in "${voice_ids[@]}"; do
  printf "   • %s … " "$id"
  status=$(curl -s -X DELETE -H "xi-api-key: $API_KEY" "$DELETE_URL/$id" | jq -r '.status')
  echo "$status"
done

echo "✅  All done."
