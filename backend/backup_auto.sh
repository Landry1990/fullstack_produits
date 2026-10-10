#!/bin/bash

# Automated Backup Trigger for Linux (Cron)
# This script should be scheduled to run every 30 minutes in Crontab.
# It will only actually perform a backup if:
# 1. It's the time configured in the app (Maintenance > Sauvegarde)
# 2. No backup has been done today yet

echo "========================================"
echo "Checking for Scheduled Backup - $(date)"
echo "========================================"

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d "my_env01" ]; then
    source my_env01/bin/activate
fi

# Run the check and backup command
python3 manage.py auto_backup >> auto_backup_log.txt 2>&1

if [ $? -eq 0 ]; then
    echo "Check completed successfully"
else
    echo "Check failed with exit code $?"
fi

echo "========================================"
