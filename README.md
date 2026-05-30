# Job Tracker

CLI tool to track job applications, follow-ups, interview stages, and send digests to Telegram. Zero dependencies, works fully offline, data stays on your machine.

## Why This?

Most job trackers are spreadsheets or paid SaaS tools. Job Tracker is a local CLI that lives in your terminal — no accounts, no subscriptions, no data leaving your machine. Track every role from first application through offer or rejection, with follow-up reminders and a Telegram digest so you never miss a deadline.

## Requirements

- Node.js 14+
- No external npm packages (uses only Node.js built-ins)

## Install

**Option 1 — Symlink to ~/bin (recommended)**
```bash
git clone https://github.com/mamuaminu/job-tracker.git
cd job-tracker
chmod +x index.js
ln -s "$(pwd)/index.js" ~/bin/job-tracker
# Now use: job-tracker <command>
```

**Option 2 — Run directly**
```bash
node /path/to/job-tracker/index.js <command>
```

**Option 3 — npm global install**
```bash
npm install -g job-tracker
```

## Core Commands

### Add an application
```bash
job-tracker add "CrowdStrike" "SOC Analyst" \
  --url=https://crowdstrike.com/jobs \
  --salary="$120k" \
  --list=applied
```

### List all applications
```bash
job-tracker list                      # show all
job-tracker list --filter=applied     # only applied
job-tracker list --filter=screening   # in screening
job-tracker list --filter=interview   # in interview round
job-tracker list --filter=offer      # got an offer
job-tracker list --filter=rejected   # rejected
```

### Update application stage
```bash
job-tracker status ABC1234 screening # moved to screening
job-tracker status ABC1234 interview # moved to interview
job-tracker status ABC1234 offer      # received offer
job-tracker status ABC1234 rejected # rejected
job-tracker status ABC1234 withdrawn # withdrew application
```

### Schedule a follow-up reminder
```bash
job-tracker followup ABC1234 --days=7   # remind in 7 days
job-tracker followup ABC1234 --days=3    # remind in 3 days
```

### Check for stale applications
```bash
job-tracker stale
# Flags any application with no update in 7+ days
```

### View statistics
```bash
job-tracker stats
# Shows: total applications, by stage, offers, rejections, hit rate
```

### Update an entry
```bash
job-tracker update ABC1234 --salary="$130k" --notes="Referred by Ahmad"
```

### Remove an entry
```bash
job-tracker remove ABC1234
```

### Export data
```bash
job-tracker export ~/Desktop/job-tracker-export.json
```

## Application Stages

The tracker uses this stage flow:

```
applied → screening → interview → offer
                                  ↘ rejected
                                  ↘ withdrawn
```

Each transition is timestamped, so the full history of every application is preserved.

## Telegram Digest

Set your Telegram bot credentials once, then send digests on demand:

```bash
# Set environment variables
export TELEGRAM_BOT_TOKEN="your_bot_token"
export TELEGRAM_CHAT_ID="your_chat_id"

# Send digest to your Telegram chat
job-tracker digest
```

The digest includes: total active applications, new additions since last check, applications per stage, and stale items.

**Getting a Telegram bot token:**
1. Message @BotFather on Telegram
2. Send /newbot and follow the steps
3. Copy the token above
4. Start a chat with your bot, then get your chat ID from @userinfobot

## Data Storage

All data is stored in `~/.job-tracker/applications.json`. No database, no API calls, no cloud. Your data never leaves your machine unless you explicitly export it.

## Example Workflow

```bash
# Day 1 — Found a role
job-tracker add "CrowdStrike" "SOC Analyst" \
  --url=https://crowdstrike.com/jobs \
  --list=applied \
  --salary="$120k"

# Day 3 — Got a screening call
job-tracker status ABC1234 screening
job-tracker followup ABC1234 --days=5

# Day 8 — Screening passed, interview scheduled
job-tracker status ABC1234 interview
job-tracker followup ABC1234 --days=7

# Day 15 — Got an offer
job-tracker status ABC1234 offer

# Any time — Check your stats
job-tracker stats
```

## Automate Weekly Digest

Add to crontab for a weekly Telegram report every Monday at 9 AM:

```bash
0 9 * * 1 TELEGRAM_BOT_TOKEN=xxx TELEGRAM_CHAT_ID=yyy job-tracker digest
```

## Files

```
job-tracker/
├── index.js           # Main CLI application
├── README.md          # This file
```

---

By Muhammad Aminu Musa
