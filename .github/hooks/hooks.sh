#!/bin/bash

# Read the entire JSON input from stdin
INPUT=$(cat)

# Parse specific fields
HOOK_EVENT=$(echo "$INPUT" | jq -r '.hookEventName')
SESSION_ID=$(echo "$INPUT" | jq -r '.sessionId')
SESSION_ID="${SESSION_ID##*/}"
DATE_PREFIX=$(date +"%d-%m-%Y")

# Log input
INPUT_LOG_DIR="logs/$DATE_PREFIX/$SESSION_ID/input"
mkdir -p "$INPUT_LOG_DIR"
echo "$INPUT" >> "$INPUT_LOG_DIR/$HOOK_EVENT.log"

# Resolve config.json path relative to repo root
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "$(dirname "$0")/../..")
CONFIG_FILE="$REPO_ROOT/config.json"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "Config file not found: $CONFIG_FILE" >&2
    exit 0
fi

# Read the config for this hook event
EVENT_CONFIG=$(jq -r --arg event "$HOOK_EVENT" '.[$event] // empty' "$CONFIG_FILE" 2>/dev/null)

# If no config for this event, exit silently
if [ -z "$EVENT_CONFIG" ] || [ "$EVENT_CONFIG" = "{}" ] || [ "$EVENT_CONFIG" = "null" ]; then
    exit 0
fi

# Filter out null and empty string values
OUTPUT=$(echo "$EVENT_CONFIG" | jq 'with_entries(select(.value != null and .value != ""))')

# If nothing left after filtering, exit silently
if [ -z "$OUTPUT" ] || [ "$OUTPUT" = "{}" ] || [ "$OUTPUT" = "null" ]; then
    exit 0
fi

# Log the output
OUTPUT_LOG_DIR="logs/$DATE_PREFIX/$SESSION_ID/output"
mkdir -p "$OUTPUT_LOG_DIR"
echo "$OUTPUT" >> "$OUTPUT_LOG_DIR/$HOOK_EVENT.log"

# Emit the output JSON
echo "$OUTPUT"
