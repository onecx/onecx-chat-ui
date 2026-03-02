#!/bin/bash
if [ "$VOICE_AI_ENABLED" != "true" ] || [ -z "$VOICE_BFF_URL" ]; then
  echo "Disabling Voice BFF location (VOICE_AI_ENABLED!=true or VOICE_BFF_URL not set)..."
  rm -f "$DIR_LOCATION/voice-bff.conf"
fi
exec /entrypoint.sh "$@"
