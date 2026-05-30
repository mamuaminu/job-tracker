#!/usr/bin/env node
/**
 * Matador Job Tracker
 * CLI tool to track job applications, follow-ups, and interview rounds.
 * 
 * Usage:
 *   job-tracker add "Company" "Role" --url=https://... --list=applied
 *   job-tracker list
 *   job-tracker followup <id>
 *   job-tracker status <id> <stage>
 *   job-tracker stale
 *   job-tracker digest
 *   job-tracker stats
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.env.HOME, '.job-tracker');
const DB_FILE = path.join(DATA_DIR, 'applications.json');

// ─── Helpers ───────────────────────────────────────────────────────────────

function ensureDB() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2));
}

function readDB() {
  ensureDB();
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function now() {
  return new Date().toISOString();
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysAgo(iso) {
  return Math.floor((Date.now() - new Date(iso)) / 86400000);
}

function uid() {
  return Math.random().toString(36).slice(2, 9).toUpperCase();
}

const STAGES = ['applied', 'screening', 'interview', 'offer', 'rejected', 'withdrawn'];
const STAGE_EMOJI = { applied: '📨', screening: '🔍', interview: '🎤', offer: '💰', rejected: '❌', withdrawn: '🚪' };
const STAGE_COLOR = { applied: '\x1b[33m', screening: '\x1b[36m', interview: '\x1b[35m', offer: '\x1b[32m', rejected: '\x1b[31m', withdrawn: '\x1b[90m' };
const RESET = '\x1b[0m';

// ─── Commands ──────────────────────────────────────────────────────────────

function cmdAdd(argv) {
  if (argv._.length < 2) {
    console.error('Usage: job-tracker add "Company" "Role" [--url=...] [--list=applied] [--salary=...] [--notes=...]');
    process.exit(1);
  }
  const company = argv._[0];
  const role = argv._[1];
  const url = argv.url || '';
  const list = argv.list || 'applied';
  const salary = argv.salary || '';
  const notes = argv.notes || '';

  const db = readDB();
  const entry = {
    id: uid(),
    company,
    role,
    url,
    stage: list,
    salary,
    notes,
    created: now(),
    updated: now(),
    followUp: null,
    followUpSent: false,
    history: [{ stage: list, date: now() }]
  };

  db.push(entry);
  writeDB(db);
  console.log(`\n  ✅ Added [${entry.id}] ${entry.company} — ${entry.role}`);
  console.log(`  📌 Stage: ${list} | URL: ${url || 'none'}`);
  console.log(`  💰 Salary: ${salary || 'not specified'}`);
  if (notes) console.log(`  📝 Notes: ${notes}`);
  console.log('');
}

function cmdList(argv) {
  const db = readDB();
  if (db.length === 0) {
    console.log('\n  📭 No applications tracked yet.\n  Run: job-tracker add "Company" "Role"\n');
    return;
  }

  const filter = argv.filter || null;
  const filtered = filter ? db.filter(e => e.stage === filter) : db;

  console.log('\n  ╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('  ║            📋 MATADOR JOB TRACKER — ' + filtered.length + ' application(s)                     ║');
  console.log('  ╠══════════════════════════════════════════════════════════════════════════╣');

  filtered.sort((a, b) => new Date(b.updated) - new Date(a.updated)).forEach(e => {
    const age = daysAgo(e.created);
    const upd = daysAgo(e.updated);
    const color = STAGE_COLOR[e.stage] || '';
    const emoji = STAGE_EMOJI[e.stage] || '📌';
    console.log(`  ║ ${emoji} [${e.id}] ${e.company.substring(0, 28).padEnd(28)}                      ║`);
    console.log(`  ║   Role: ${e.role.substring(0, 55).padEnd(55)}  ║`);
    console.log(`  ║   Stage: ${color}${e.stage.toUpperCase().padEnd(12)}${RESET} | Added: ${fmtDate(e.created)} (${age}d ago)         ║`);
    if (e.url) console.log(`  ║   URL:   ${e.url.substring(0, 63).padEnd(63)}  ║`);
    if (e.salary) console.log(`  ║   Salary: ${e.salary.padEnd(60)}  ║`);
    if (e.followUp && !e.followUpSent) {
      const fuDays = daysAgo(e.followUp);
      if (fuDays >= 0) console.log(`  ║   ⚠️  Follow-up due: ${fmtDate(e.followUp)} (${fuDays}d ago)         ║`);
    }
    console.log('  ╠══════════════════════════════════════════════════════════════════════════╣');
  });

  console.log(`\n  Tip: job-tracker list --filter=interview  (or screening|offer|rejected)\n`);
}

function cmdStatus(argv) {
  if (argv._.length < 2) {
    console.error('Usage: job-tracker status <id> <stage>');
    process.exit(1);
  }
  const id = argv._[0].toUpperCase();
  const newStage = argv._[1].toLowerCase();

  if (!STAGES.includes(newStage)) {
    console.error(`Stage must be one of: ${STAGES.join(', ')}`);
    process.exit(1);
  }

  const db = readDB();
  const entry = db.find(e => e.id === id);
  if (!entry) { console.error(`Application [${id}] not found.`); process.exit(1); }

  const oldStage = entry.stage;
  entry.stage = newStage;
  entry.updated = now();
  entry.history.push({ stage: newStage, date: now() });

  writeDB(db);
  const emoji = STAGE_EMOJI[newStage] || '📌';
  console.log(`\n  ${emoji} [${id}] ${entry.company} — ${entry.role}`);
  console.log(`  ${oldStage} → ${newStage}`);
  console.log('');
}

function cmdFollowup(argv) {
  if (argv._.length < 2) {
    console.error('Usage: job-tracker followup <id> [--days=7]');
    process.exit(1);
  }
  const id = argv._[0].toUpperCase();
  const days = parseInt(argv.days || '7');

  const db = readDB();
  const entry = db.find(e => e.id === id);
  if (!entry) { console.error(`Application [${id}] not found.`); process.exit(1); }

  const followUpDate = new Date(Date.now() + days * 86400000).toISOString();
  entry.followUp = followUpDate;
  entry.followUpSent = false;
  entry.updated = now();

  writeDB(db);
  console.log(`\n  ⏰ Follow-up set for ${fmtDate(followUpDate)} (+${days}d)`);
  console.log(`  [${id}] ${entry.company} — ${entry.role}\n`);
}

function cmdStale(argv) {
  const db = readDB();
  const stale = db.filter(e => ['applied', 'screening'].includes(e.stage) && daysAgo(e.updated) >= 7);

  console.log('\n  ⚠️  STALE APPLICATIONS (no update in 7+ days)\n');
  if (stale.length === 0) { console.log('  ✅ All active applications are fresh.\n'); return; }

  stale.forEach(e => {
    const age = daysAgo(e.updated);
    const emoji = STAGE_EMOJI[e.stage] || '📌';
    console.log(`  ${emoji} [${e.id}] ${e.company} — ${e.role}`);
    console.log(`      Stage: ${e.stage} | Last update: ${age}d ago | URL: ${e.url || 'none'}`);
    console.log('');
  });

  console.log(`  ${stale.length} application(s) need attention.\n`);
  console.log('  To update: job-tracker status <id> <new-stage>\n');
}

async function cmdDigest(argv) {
  const db = readDB();
  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  const tgChat = process.env.TELEGRAM_CHAT_ID;

  if (!tgToken || !tgChat) {
    console.log('\n  ℹ️  Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID for Telegram digest.\n');
  }

  const total = db.length;
  const byStage = {};
  STAGES.forEach(s => byStage[s] = 0);
  db.forEach(e => { if (byStage[e.stage] !== undefined) byStage[e.stage]++; });

  const stale = db.filter(e => ['applied', 'screening'].includes(e.stage) && daysAgo(e.updated) >= 7);
  const thisWeek = db.filter(e => daysAgo(e.created) <= 7);
  const last7days = db.filter(e => daysAgo(e.updated) <= 7);

  let md = `📊 *MATADOR JOB DIGEST* — ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}\n\n`;
  md += `*Total tracked:* ${total} application(s)\n\n`;
  md += `*By Stage:*\n`;
  STAGES.forEach(s => {
    if (byStage[s] > 0) md += `  ${STAGE_EMOJI[s]} ${s}: ${byStage[s]}\n`;
  });
  md += `\n*This week:* ${thisWeek.length} new applied\n`;
  md += `*Stale (7+d):* ${stale.length}\n`;
  if (stale.length > 0) {
    md += `\n*⚠️ Needs Attention:*\n`;
    stale.forEach(e => md += `  → ${e.company} (${e.role}) — ${e.stage}\n`);
  }

  console.log('\n' + md + '\n');

  if (tgToken && tgChat) {
    try {
      const { execSync } = require('child_process');
      const msg = encodeURIComponent(md);
      execSync(`curl -s -X POST https://api.telegram.org/bot${tgToken}/sendMessage -d chat_id=${tgChat} -d text="${msg}" -d parse_mode=Markdown`, { stdio: 'ignore' });
      console.log('  📱 Digest sent to Telegram.\n');
    } catch (e) {
      console.log('  ⚠️ Telegram send failed.\n');
    }
  }
}

function cmdStats(argv) {
  const db = readDB();

  const total = db.length;
  const byStage = {};
  STAGES.forEach(s => byStage[s] = 0);
  db.forEach(e => { if (byStage[e.stage] !== undefined) byStage[e.stage]++; });

  const active = db.filter(e => !['rejected', 'withdrawn'].includes(e.stage)).length;
  const thisWeek = db.filter(e => daysAgo(e.created) <= 7).length;
  const stale = db.filter(e => ['applied', 'screening'].includes(e.stage) && daysAgo(e.updated) >= 7).length;

  console.log('\n  ┌─────────────────────────────────────┐');
  console.log('  │   📊 JOB TRACKER STATISTICS          │');
  console.log('  ├─────────────────────────────────────┤');
  console.log(`  │   Total applications:     ${String(total).padStart(5)}  │`);
  console.log(`  │   Active (non-rejected):  ${String(active).padStart(5)}  │`);
  console.log(`  │   Applied this week:      ${String(thisWeek).padStart(5)}  │`);
  console.log(`  │   Stale (need follow-up): ${String(stale).padStart(5)}  │`);
  console.log('  ├─────────────────────────────────────┤');
  console.log('  │   By Stage:                         │');
  STAGES.forEach(s => {
    if (byStage[s] > 0) console.log(`  │   ${STAGE_EMOJI[s]} ${s.padEnd(14)} ${String(byStage[s]).padStart(5)}  │`);
  });
  console.log('  └─────────────────────────────────────┘\n');
}

function cmdRemove(argv) {
  if (!argv._[0]) { console.error('Usage: job-tracker remove <id>'); process.exit(1); }
  const id = argv._[0].toUpperCase();
  const db = readDB();
  const idx = db.findIndex(e => e.id === id);
  if (idx === -1) { console.error(`Application [${id}] not found.`); process.exit(1); }
  const [removed] = db.splice(idx, 1);
  writeDB(db);
  console.log(`\n  🗑️  Removed [${id}] ${removed.company} — ${removed.role}\n`);
}

function cmdUpdate(argv) {
  if (!argv._[0]) { console.error('Usage: job-tracker update <id> [--company=] [--role=] [--url=] [--salary=] [--notes=]'); process.exit(1); }
  const id = argv._[0].toUpperCase();
  const db = readDB();
  const entry = db.find(e => e.id === id);
  if (!entry) { console.error(`Application [${id}] not found.`); process.exit(1); }

  if (argv.company) entry.company = argv.company;
  if (argv.role) entry.role = argv.role;
  if (argv.url !== undefined) entry.url = argv.url;
  if (argv.salary !== undefined) entry.salary = argv.salary;
  if (argv.notes !== undefined) entry.notes = argv.notes;
  entry.updated = now();

  writeDB(db);
  console.log(`\n  ✏️  Updated [${id}] ${entry.company} — ${entry.role}\n`);
}

function cmdExport(argv) {
  const db = readDB();
  const outPath = argv._[0] || path.join(DATA_DIR, 'export.json');
  fs.writeFileSync(outPath, JSON.stringify(db, null, 2));
  console.log(`\n  📁 Exported ${db.length} application(s) to ${outPath}\n`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

const COMMANDS = {
  add: cmdAdd,
  list: cmdList,
  ls: cmdList,
  status: cmdStatus,
  followup: cmdFollowup,
  stale: cmdStale,
  digest: cmdDigest,
  stats: cmdStats,
  remove: cmdRemove,
  rm: cmdRemove,
  update: cmdUpdate,
  export: cmdExport,
};

function parseArgv(argv) {
  // Simple argv parser: --key=value --key "value" positional
  const out = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      out[k] = v || true;
    } else {
      out._.push(a);
    }
  }
  return out;
}

const args = parseArgv(process.argv);
const cmd = args._[0] || 'help';

if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
  console.log(`\n  Matador Job Tracker v1.0.0\n`);
  console.log(`  Commands:`);
  console.log(`    add "Company" "Role" --url=... --list=applied --salary=...  Add application`);
  console.log(`    list [--filter=stage]        List all applications`);
  console.log(`    status <id> <stage>         Update stage (applied|screening|interview|offer|rejected|withdrawn)`);
  console.log(`    followup <id> [--days=7]    Schedule follow-up reminder`);
  console.log(`    stale                       Show applications with no update in 7+ days`);
  console.log(`    digest                      Show/telegram digest of all applications`);
  console.log(`    stats                       Show statistics`);
  console.log(`    update <id> [--company=] [--role=] [--url=]  Update entry`);
  console.log(`    remove <id>                 Remove application`);
  console.log(`    export [path]               Export to JSON`);
  console.log(`\n  Environment:`);
  console.log(`    TELEGRAM_BOT_TOKEN  Send digest to Telegram`);
  console.log(`    TELEGRAM_CHAT_ID    Your Telegram chat ID`);
  console.log(`\n  Examples:`);
  console.log(`    job-tracker add "Trace3" "SOC Analyst" --url=https://trace3.com/careers --salary="\$90k" --list=applied`);
  console.log(`    job-tracker status ABC1234 interview`);
  console.log(`    job-tracker followup ABC1234 --days=5`);
  console.log(`    job-tracker digest`);
  console.log(`\n`);
} else if (COMMANDS[cmd]) {
  COMMANDS[cmd](args);
} else {
  console.error(`Unknown command: ${cmd}. Run: job-tracker help`);
  process.exit(1);
}