# JobTracker — ATS CLI

> Track every job application, interview, and offer from your terminal.

![Node](https://img.shields.io/badge/node-%3E%3D14-brightgreen) ![MIT](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Add** applications with role, company, URL, salary, and tags
- **List** all applications, filter by stage or tag
- **Track stages** — applied → screening → interview → offer | rejected | ghost
- **Notes & tagging** — add notes and custom tags to any application
- **Follow-up reminders** — schedule follow-ups and see overdue items
- **Stale detection** — automatically flags applications with no update in 7+ days
- **Statistics** — summary of your pipeline by stage
- **Telegram digest** — send a formatted digest to your Telegram bot
- **Export** — export all data to JSON

## Install

```bash
git clone https://github.com/mamuaminu/job-tracker.git ~/job-tracker
cp ~/job-tracker/index.js ~/bin/jobtracker
chmod +x ~/bin/jobtracker
```

Or use directly:

```bash
node ~/job-tracker/index.js <command>
```

## Commands

```
jobtracker add "Company" "Role" [--url=https://...] [--stage=applied] [--salary=...] [--tag=...]
jobtracker list [stage|#tag]
jobtracker status <id> <stage>
jobtracker note <id> <text>
jobtracker tag <id> <tag>
jobtracker followup <id> [--days=7]
jobtracker stale
jobtracker digest
jobtracker stats
jobtracker update <id> [--company=] [--role=] [--url=] [--salary=]
jobtracker remove <id>
jobtracker export [path]
jobtracker clear
```

### Stage Workflow

```
applied → screening → interview → offer
                             ↘ rejected / ghost / withdrawn
```

## Usage Examples

```bash
# Add a new application
jobtracker add "Trace3" "SOC Analyst I" --url=https://trace3.com/careers --salary="\$90k" --tag=soc

# Track an interview
jobtracker status ABC1234 interview

# Landed an interview — add a note
jobtracker note ABC1234 "HR called — technical round scheduled for Thursday"

# Tag it
jobtracker tag ABC1234 priority

# Schedule a follow-up
jobtracker followup ABC1234 --days=5

# Check stale applications
jobtracker stale

# Get your stats
jobtracker stats

# Send digest to Telegram
TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... jobtracker digest
```

## Telegram Digest

Set environment variables once:

```bash
export TELEGRAM_BOT_TOKEN="your-bot-token"
export TELEGRAM_CHAT_ID="your-chat-id"
jobtracker digest
```

## Data

All data is stored in `~/.job-tracker/applications.json`. No external database, no API keys needed for core functionality.

---

JobTracker — open source ATS CLI