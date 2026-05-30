# Matador Job Tracker

CLI tool to track job applications, follow-ups, interview rounds, and send digests to Telegram. Built for Muhammad Aminu Musa (El Matador) during his job search.

## Install

```bash
cp ~/.openclaw/workspace/job-tracker/index.js ~/bin/job-tracker
chmod +x ~/bin/job-tracker
```

Or use directly with `node ~/.openclaw/workspace/job-tracker/index.js <command>`.

## Commands

### Add an application
```bash
job-tracker add "Trace3" "SOC Analyst I" \
  --url=https://trace3.com/careers \
  --salary="\$90,000" \
  --list=applied
```

### List all applications
```bash
job-tracker list                    # all
job-tracker list --filter=interview  # filter by stage
job-tracker list --filter=applied   # jobs you applied to
```

### Update stage
```bash
job-tracker status ABC1234 interview   # move to interview round
job-tracker status ABC1234 offer        # you got an offer!
job-tracker status ABC1234 rejected     # move to rejected
```

### Schedule follow-up
```bash
job-tracker followup ABC1234 --days=7   # remind in 7 days
job-tracker followup ABC1234 --days=3    # remind in 3 days
```

### Check stale applications (7+ days no update)
```bash
job-tracker stale
```

### Get digest
```bash
job-tracker digest          # show to stdout
TELEGRAM_BOT_TOKEN=xxx TELEGRAM_CHAT_ID=1842342246 job-tracker digest  # send to Telegram
```

### Statistics
```bash
job-tracker stats
```

### Update an entry
```bash
job-tracker update ABC1234 --salary="\$95,000" --notes="Referred by Ahmad"
```

### Remove an entry
```bash
job-tracker remove ABC1234
```

### Export data
```bash
job-tracker export ~/Desktop/job-tracker-export.json
```

## Stages

`applied` → `screening` → `interview` → `offer` | `rejected` | `withdrawn`

## Telegram Digest

Set environment variables:
```bash
export TELEGRAM_BOT_TOKEN="your_bot_token"
export TELEGRAM_CHAT_ID="1842342246"
job-tracker digest
```

## Data Storage

All data is stored in `~/.job-tracker/applications.json`. No external database, no API keys needed for core functionality.

## Examples in Context

Job searching while building every night:
```bash
# After applying to a role
job-tracker add "CrowdStrike" "SOC Analyst" --url=https://crowdstrike.com/jobs --list=applied --salary="\$120k"

# After a screening call
job-tracker status ABC1234 screening

# After interview round 1
job-tracker status ABC1234 interview
job-tracker followup ABC1234 --days=5

# Weekly digest every Monday morning
0 9 * * 1 TELEGRAM_BOT_TOKEN=xxx TELEGRAM_CHAT_ID=yyy ~/bin/job-tracker digest
```

## Why This?

El Matador is ISC2 CC + CISCO pentest certified, job hunting across Europe/Middle East/Asia.
He builds something new every night. This tool helps him stay organized and follow up on every opportunity — because missing a follow-up is worse than not applying at all.