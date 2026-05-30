#!/usr/bin/env node
/**
 * JobTracker — CLI tool to track job applications, follow-ups, interview rounds, and more.
 *
 * Usage:
 *   jobtracker add "Company" "Role" --url=https://... --stage=applied --salary=... --tag=...
 *   jobtracker list [stage]
 *   jobtracker status <id> <stage>
 *   jobtracker note <id> <text>
 *   jobtracker tag <id> <tag>
 *   jobtracker followup <id> [--days=7]
 *   jobtracker stale
 *   jobtracker digest
 *   jobtracker stats
 *   jobtracker update <id> [--company=] [--role=] [--url=] [--salary=] [--notes=]
 *   jobtracker remove <id>
 *   jobtracker export [path]
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

const STAGES = ['applied', 'screening', 'interview', 'offer', 'rejected', 'withdrawn', 'ghost'];
const STAGE_EMOJI = {
  applied: '📨', screening: '🔍', interview: '🎤', offer: '💰',
  rejected: '❌', withdrawn: '🚪', ghost: '👻'
};
const STAGE_COLOR = {
  applied: '\x1b[33m', screening: '\x1b[36m', interview: '\x1b[35m',
  offer: '\x1b[32m', rejected: '\x1b[31m', withdrawn: '\x1b[90m', ghost: '\x1b[90m'
};
const RESET = '\x1b[0m';

// ─── Commands ──────────────────────────────────────────────────────────────

function cmdAdd(argv) {
  if (argv._.length < 2) {
    console.error('Usage: jobtracker add "Company" "Role" [--url=...] [--stage=applied] [--salary=...] [--tag=...] [--notes=...]');
    process.exit(1);
  }
  const company = argv._[0];
  const role = argv._[1];
  const url = argv.url || '';
  const stage = argv.stage || 'applied';
  const salary = argv.salary || '';
  const tag = argv.tag || 'general';
  const notes = argv.notes || '';

  const db = readDB();
  const entry = {
    id: uid(),
    company,
    role,
    url,
    stage,
    salary,
    tag,
    notes,
    created: now(),
    updated: now(),
    followUp: null,
    followUpSent: false,
    history: [{ stage, date: now() }],
    noteLog: notes ? [{ text: notes, date: now() }] : []
  };

  db.push(entry);
  writeDB(db);
  console.log(`\n  ✅ Added [${entry.id}] ${entry.company} — ${entry.role}`);
  console.log(`  📌 Stage: ${stage} | Tag: #${tag} | URL: ${url || 'none'}`);
  if (salary) console.log(`  💰 Salary: ${salary}`);
  console.log('');
}

function cmdList(argv) {
  const db = readDB();
  const filter = argv._[0] || null;

  if (db.length === 0) {
    console.log('\n  📭 No applications tracked yet.\n  Run: jobtracker add "Company" "Role"\n');
    return;
  }

  const filtered = filter
    ? db.filter(e => e.stage === filter || e.tag === filter)
    : db;

  console.log('\n  ╔══════════════════════════════════════════════════════════════════════════╗');
  console.log(`  ║            📋 JOB TRACKER — ${String(filtered.length).padStart(2)} application(s)                           ║`);
  console.log('  ╠══════════════════════════════════════════════════════════════════════════╣');

  filtered.sort((a, b) => new Date(b.updated) - new Date(a.updated)).forEach(e => {
    const age = daysAgo(e.created);
    const color = STAGE_COLOR[e.stage] || '';
    const emoji = STAGE_EMOJI[e.stage] || '📌';
    console.log(`  ║ ${emoji} [${e.id}] ${e.company.substring(0, 28).padEnd(28)}            ║`);
    console.log(`  ║   Role: ${e.role.substring(0, 55).padEnd(55)}  ║`);
    console.log(`  ║   Stage: ${color}${e.stage.toUpperCase().padEnd(12)}${RESET} | Tag: #${e.tag} | Added: ${age}d ago    ║`);
    if (e.url) console.log(`  ║   URL:   ${e.url.substring(0, 70).padEnd(70)}  ║`);
    if (e.salary) console.log(`  ║   Salary: ${e.salary.padEnd(67)}  ║`);
    if (e.noteLog && e.noteLog.length > 0) {
      console.log(`  ║   📝 ${e.noteLog[e.noteLog.length - 1].text.substring(0, 70).padEnd(70)}  ║`);
    }
    if (e.followUp && !e.followUpSent) {
      const fuDays = daysAgo(e.followUp);
      if (fuDays >= 0) console.log(`  ║   ⏰ Follow-up: ${fmtDate(e.followUp)} (${fuDays}d overdue)        ║`);
    }
    console.log('  ╠══════════════════════════════════════════════════════════════════════════╣');
  });

  console.log(`\n  Tip: jobtracker list <stage>  or  jobtracker list #<tag>\n`);
}

function cmdStatus(argv) {
  if (argv._.length < 2) {
    console.error('Usage: jobtracker status <id> <stage>');
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

function cmdNote(argv) {
  if (argv._.length < 2) {
    console.error('Usage: jobtracker note <id> <text>');
    process.exit(1);
  }
  const id = argv._[0].toUpperCase();
  const text = argv._.slice(1).join(' ');

  const db = readDB();
  const entry = db.find(e => e.id === id);
  if (!entry) { console.error(`Application [${id}] not found.`); process.exit(1); }

  if (!entry.noteLog) entry.noteLog = [];
  entry.noteLog.push({ text, date: now() });
  entry.updated = now();

  writeDB(db);
  console.log(`\n  📝 Added note to [${id}] ${entry.company}\n`);
}

function cmdTag(argv) {
  if (argv._.length < 2) {
    console.error('Usage: jobtracker tag <id> <tag>');
    process.exit(1);
  }
  const id = argv._[0].toUpperCase();
  const tag = argv._[1];

  const db = readDB();
  const entry = db.find(e => e.id === id);
  if (!entry) { console.error(`Application [${id}] not found.`); process.exit(1); }

  entry.tag = tag;
  entry.updated = now();
  writeDB(db);
  console.log(`\n  🏷️  Tagged [${id}] as #${tag}\n`);
}

function cmdFollowup(argv) {
  if (argv._.length < 1) {
    console.error('Usage: jobtracker followup <id> [--days=7]');
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
  const stale = db.filter(e => ['applied', 'screening', 'ghost'].includes(e.stage) && daysAgo(e.updated) >= 7);

  console.log('\n  ⚠️  STALE APPLICATIONS (no update in 7+ days)\n');
  if (stale.length === 0) { console.log('  ✅ All active applications are fresh.\n'); return; }

  stale.forEach(e => {
    const age = daysAgo(e.updated);
    const emoji = STAGE_EMOJI[e.stage] || '📌';
    console.log(`  ${emoji} [${e.id}] ${e.company} — ${e.role}`);
    console.log(`      Stage: ${e.stage} | Last update: ${age}d ago | #${e.tag}`);
    if (e.url) console.log(`      URL: ${e.url}`);
    console.log('');
  });

  console.log(`  ${stale.length} application(s) need attention.\n`);
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

  const stale = db.filter(e => ['applied', 'screening', 'ghost'].includes(e.stage) && daysAgo(e.updated) >= 7);
  const thisWeek = db.filter(e => daysAgo(e.created) <= 7);

  let md = `📊 *JOB TRACKER DIGEST* — ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}\n\n`;
  md += `*Total tracked:* ${total} application(s)\n\n`;
  md += `*By Stage:*\n`;
  STAGES.forEach(s => {
    if (byStage[s] > 0) md += `  ${STAGE_EMOJI[s] || '📌'} ${s}: ${byStage[s]}\n`;
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
  const stale = db.filter(e => ['applied', 'screening', 'ghost'].includes(e.stage) && daysAgo(e.updated) >= 7).length;

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
    if (byStage[s] > 0) console.log(`  │   ${STAGE_EMOJI[s] || '📌'} ${s.padEnd(14)} ${String(byStage[s]).padStart(5)}  │`);
  });
  console.log('  └─────────────────────────────────────┘\n');
}

function cmdRemove(argv) {
  if (!argv._[0]) { console.error('Usage: jobtracker remove <id>'); process.exit(1); }
  const id = argv._[0].toUpperCase();
  const db = readDB();
  const idx = db.findIndex(e => e.id === id);
  if (idx === -1) { console.error(`Application [${id}] not found.`); process.exit(1); }
  const [removed] = db.splice(idx, 1);
  writeDB(db);
  console.log(`\n  🗑️  Removed [${id}] ${removed.company} — ${removed.role}\n`);
}

function cmdUpdate(argv) {
  if (!argv._[0]) { console.error('Usage: jobtracker update <id> [--company=] [--role=] [--url=] [--salary=] [--notes=]'); process.exit(1); }
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

function cmdClear(argv) {
  const db = readDB();
  if (db.length === 0) { console.log('\n  ℹ️  Nothing to clear.\n'); return; }
  const backup = path.join(DATA_DIR, `backup-${Date.now()}.json`);
  fs.writeFileSync(backup, JSON.stringify(db, null, 2));
  writeDB([]);
  console.log(`\n  🗑️  Cleared ${db.length} application(s). Backup saved to ${backup}\n`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

const COMMANDS = {
  add: cmdAdd,
  list: cmdList,
  ls: cmdList,
  status: cmdStatus,
  note: cmdNote,
  tag: cmdTag,
  followup: cmdFollowup,
  stale: cmdStale,
  digest: cmdDigest,
  stats: cmdStats,
  remove: cmdRemove,
  rm: cmdRemove,
  update: cmdUpdate,
  export: cmdExport,
  clear: cmdClear,
};

function parseArgv(argv) {
  const out = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      out[k] = v || true;
    } else if (a.startsWith('-') && a.length > 1) {
      const k = a.slice(1);
      out[k] = true;
    } else {
      out._.push(a);
    }
  }
  return out;
}

const args = parseArgv(process.argv);
const cmd = args._[0] || 'help';

if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
  console.log(`\n  JobTracker v2.0.0\n`);
  console.log(`  Commands:`);
  console.log(`    add "Company" "Role" [--url=...] [--stage=applied] [--salary=...] [--tag=...]  Add application`);
  console.log(`    list [stage|#tag]           List all applications (filter by stage or tag)`);
  console.log(`    status <id> <stage>         Update stage (${STAGES.join('|')})`);
  console.log(`    note <id> <text>             Add a note to an application`);
  console.log(`    tag <id> <tag>               Tag an application`);
  console.log(`    followup <id> [--days=7]     Schedule follow-up reminder`);
  console.log(`    stale                        Show applications with no update in 7+ days`);
  console.log(`    digest                       Show/telegram digest of all applications`);
  console.log(`    stats                        Show statistics`);
  console.log(`    update <id> [--company=] [--role=] [--url=] [--salary=]  Update entry`);
  console.log(`    remove <id>                  Remove application`);
  console.log(`    export [path]                Export to JSON`);
  console.log(`    clear                        Reset all data (creates backup)`);
  console.log(`\n  Environment:`);
  console.log(`    TELEGRAM_BOT_TOKEN  Send digest to Telegram`);
  console.log(`    TELEGRAM_CHAT_ID    Your Telegram chat ID`);
  console.log(`\n  Data: ~/.job-tracker/applications.json\n`);
} else if (COMMANDS[cmd]) {
  COMMANDS[cmd](args);
} else {
  console.error(`Unknown command: ${cmd}. Run: jobtracker help`);
  process.exit(1);
}