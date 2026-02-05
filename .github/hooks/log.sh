#!/bin/bash

# Read the entire JSON input from stdin
INPUT=$(cat)

# Parse fields
SESSION_ID=$(echo "$INPUT" | jq -r '.sessionId')
SESSION_ID="${SESSION_ID##*/}"
HOOK_EVENT=$(echo "$INPUT" | jq -r '.hookEventName')

# Create the session log directory
LOG_DIR="logs/$SESSION_ID"
mkdir -p "$LOG_DIR"

# Append input to the event-specific log file
echo "$INPUT" >> "$LOG_DIR/$HOOK_EVENT.log"
