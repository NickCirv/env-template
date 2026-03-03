#!/usr/bin/env node
/**
 * env-template — Generate .env.example from .env
 * Strip values, keep keys, validate team sync
 * Zero external dependencies. Node 18+.
 * SECURITY: This tool NEVER writes actual env values to any output.
 */

import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'fs';
import { resolve, basename } from 'path';

// ─── ANSI colours ────────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

const ok = (s) => `${c.green}${s}${c.reset}`;
const warn = (s) => `${c.yellow}${s}${c.reset}`;
const err = (s) => `${c.red}${s}${c.reset}`;
const info = (s) => `${c.cyan}${s}${c.reset}`;
const dim = (s) => `${c.dim}${s}${c.reset}`;

// ─── Argument parsing ─────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = argv.slice(2);
  const flags = {};
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (key.startsWith('no-')) {
        flags[key.slice(3)] = false;
      } else if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        flags[key] = args[++i];
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { command: positional[0], flags };
}

// ─── File reading ─────────────────────────────────────────────────────────────
function readEnvFile(filePath) {
  const abs = resolve(filePath);
  if (!existsSync(abs)) return null;
  return readFileSync(abs, 'utf8');
}

// ─── Line parsing ─────────────────────────────────────────────────────────────
/**
 * Parse env file into structured lines.
 * SECURITY: values are read only for internal key extraction — never echoed.
 */
function parseLines(content) {
  return content.split('\n').map((raw) => {
    const trimmed = raw.trim();

    // Blank line
    if (trimmed === '') return { type: 'blank', raw };

    // Comment line
    if (trimmed.startsWith('#')) return { type: 'comment', raw, text: trimmed };

    // Key=value line (may have inline comment)
    const eqIdx = raw.indexOf('=');
    if (eqIdx !== -1) {
      const key = raw.slice(0, eqIdx).trim();
      // SECURITY: value is extracted only to confirm existence, never stored long-term or output
      const hasValue = eqIdx < raw.length - 1;
      return { type: 'entry', raw, key, hasValue };
    }

    // Unparseable — preserve as-is
    return { type: 'other', raw };
  });
}

/**
 * Extract only key names from parsed lines — never values.
 */
function extractKeys(lines) {
  return lines
    .filter((l) => l.type === 'entry')
    .map((l) => l.key);
}

// ─── Smart placeholder generation ────────────────────────────────────────────
const SENSITIVE_PATTERNS = [
  /(_KEY|_SECRET|_TOKEN|_PASSWORD|_PASS|_PWD|_CREDENTIAL|_PRIVATE|_AUTH)$/i,
  /^(API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY|AUTH_TOKEN)$/i,
];

/**
 * Generate a human-friendly placeholder — NEVER a real value.
 * All output is static hint strings, not env values.
 */
function generatePlaceholder(key) {
  const upper = key.toUpperCase();

  if (/DATABASE_/.test(upper) || /DB_URL/.test(upper) || /DATABASE_URL/.test(upper)) {
    return 'postgres://user:pass@localhost:5432/dbname';
  }
  if (/_URL$/.test(upper) || /_HOST$/.test(upper) || /^(APP_URL|BASE_URL|API_URL|HOST)$/.test(upper)) {
    return 'https://example.com';
  }
  if (/_PORT$/.test(upper) || /^PORT$/.test(upper)) {
    return '3000';
  }
  if (/_ENV$/.test(upper) || /^(NODE_ENV|APP_ENV|ENVIRONMENT)$/.test(upper)) {
    return 'development';
  }
  if (/_EMAIL$/.test(upper) || /^(EMAIL|SMTP_USER|MAIL_FROM)$/.test(upper)) {
    return 'you@example.com';
  }

  // Detect key/secret/token patterns — generate descriptive hint, not a real value
  const keyMatch = key.match(/^(.+?)_(KEY|SECRET|TOKEN|PASSWORD|PASS|PWD|AUTH)$/i);
  if (keyMatch) {
    const prefix = keyMatch[1].toLowerCase().replace(/_/g, '_');
    const suffix = keyMatch[2].toLowerCase();
    return `your_${prefix}_${suffix}_here`;
  }

  // Generic sensitive
  if (SENSITIVE_PATTERNS.some((p) => p.test(key))) {
    return `your_${key.toLowerCase()}_here`;
  }

  return '';
}

// ─── isSensitiveKey helper ────────────────────────────────────────────────────
function isSensitiveKey(key) {
  return SENSITIVE_PATTERNS.some((p) => p.test(key));
}

// ─── Commands ─────────────────────────────────────────────────────────────────

/**
 * GENERATE — read .env, write .env.example with stripped values.
 * SECURITY: output file contains ONLY key names + placeholder strings. Never real values.
 */
function cmdGenerate(flags) {
  const inputPath = flags.input || '.env';
  const outputPath = flags.output || '.env.example';
  const useHints = flags.hints !== false; // default true unless --no-hints

  const content = readEnvFile(inputPath);
  if (content === null) {
    console.error(err(`Error: Cannot read "${inputPath}" — file not found.`));
    process.exit(1);
  }

  const lines = parseLines(content);
  const outLines = [];

  for (const line of lines) {
    if (line.type === 'blank') {
      outLines.push('');
    } else if (line.type === 'comment') {
      outLines.push(line.raw);
    } else if (line.type === 'entry') {
      // SECURITY: We only use the key name, never the value
      const placeholder = useHints ? generatePlaceholder(line.key) : '';
      outLines.push(`${line.key}=${placeholder}`);
    } else {
      outLines.push(line.raw);
    }
  }

  const outputContent = outLines.join('\n');
  const absOut = resolve(outputPath);
  writeFileSync(absOut, outputContent, 'utf8');

  const keyCount = lines.filter((l) => l.type === 'entry').length;
  console.log(ok(`✓ Generated ${outputPath}`));
  console.log(dim(`  ${keyCount} keys written — all values stripped`));
  if (!useHints) console.log(dim('  Hint placeholders disabled (--no-hints)'));
}

/**
 * CHECK — compare .env against .env.example.
 * Reports missing keys (in template but not in env) and undocumented keys.
 */
function cmdCheck(flags) {
  const envPath = flags.env || '.env';
  const templatePath = flags.template || '.env.example';

  const envContent = readEnvFile(envPath);
  const templateContent = readEnvFile(templatePath);

  if (envContent === null) {
    console.error(err(`Error: Cannot read "${envPath}" — file not found.`));
    process.exit(1);
  }
  if (templateContent === null) {
    console.error(err(`Error: Cannot read "${templatePath}" — file not found.`));
    console.error(dim(`  Run: env-template generate --output ${templatePath}`));
    process.exit(1);
  }

  const envKeys = new Set(extractKeys(parseLines(envContent)));
  const templateKeys = new Set(extractKeys(parseLines(templateContent)));

  const missing = [...templateKeys].filter((k) => !envKeys.has(k));
  const undocumented = [...envKeys].filter((k) => !templateKeys.has(k));

  let hasProblems = false;

  if (missing.length === 0 && undocumented.length === 0) {
    console.log(ok(`✓ All good — ${envPath} is in sync with ${templatePath}`));
    console.log(dim(`  ${envKeys.size} keys checked`));
    return;
  }

  if (missing.length > 0) {
    hasProblems = true;
    console.log(err(`\n❌ MISSING keys (in template, not in ${basename(envPath)}):`));
    for (const key of missing) {
      console.log(`  ${err('❌')} ${key}`);
    }
  }

  if (undocumented.length > 0) {
    console.log(warn(`\n⚠️  UNDOCUMENTED keys (in ${basename(envPath)}, not in template):`));
    for (const key of undocumented) {
      console.log(`  ${warn('⚠️ ')} ${key}`);
    }
  }

  console.log('');

  if (hasProblems) process.exit(1);
}

/**
 * DIFF — show which keys differ between .env and .env.example.
 * Only shows key names — never values.
 */
function cmdDiff(flags) {
  const envPath = flags.env || '.env';
  const templatePath = flags.template || '.env.example';

  const envContent = readEnvFile(envPath);
  const templateContent = readEnvFile(templatePath);

  if (envContent === null) {
    console.error(err(`Error: Cannot read "${envPath}"`));
    process.exit(1);
  }
  if (templateContent === null) {
    console.error(err(`Error: Cannot read "${templatePath}"`));
    process.exit(1);
  }

  const envKeys = new Set(extractKeys(parseLines(envContent)));
  const templateKeys = new Set(extractKeys(parseLines(templateContent)));

  const allKeys = new Set([...envKeys, ...templateKeys]);
  const sorted = [...allKeys].sort();

  let hasDiff = false;

  console.log(info(`\nKey diff: ${basename(envPath)} vs ${basename(templatePath)}\n`));

  for (const key of sorted) {
    const inEnv = envKeys.has(key);
    const inTemplate = templateKeys.has(key);

    if (inEnv && inTemplate) {
      console.log(`  ${dim('  ')} ${key}`);
    } else if (inEnv && !inTemplate) {
      hasDiff = true;
      console.log(`  ${warn('+ ')} ${warn(key)} ${dim('(only in .env)')}`);
    } else {
      hasDiff = true;
      console.log(`  ${err('- ')} ${err(key)} ${dim('(only in template)')}`);
    }
  }

  console.log('');
  if (!hasDiff) {
    console.log(ok('No diff — keys are identical.'));
  }
}

/**
 * SYNC — add keys from .env.example that are missing from .env.
 * Appends missing keys with empty values. NEVER reads or writes actual values.
 */
function cmdSync(flags) {
  const envPath = flags.env || '.env';
  const templatePath = flags.template || '.env.example';

  const envContent = readEnvFile(envPath);
  const templateContent = readEnvFile(templatePath);

  if (templateContent === null) {
    console.error(err(`Error: Cannot read "${templatePath}"`));
    process.exit(1);
  }

  const templateLines = parseLines(templateContent);
  const templateKeys = extractKeys(templateLines);

  // If .env doesn't exist, create it from scratch with empty values
  if (envContent === null) {
    const outLines = templateLines.map((line) => {
      if (line.type === 'entry') return `${line.key}=`;
      return line.raw;
    });
    const absEnv = resolve(envPath);
    writeFileSync(absEnv, outLines.join('\n'), 'utf8');
    console.log(ok(`✓ Created ${envPath} with ${templateKeys.length} empty keys`));
    return;
  }

  const envKeys = new Set(extractKeys(parseLines(envContent)));
  const missing = templateKeys.filter((k) => !envKeys.has(k));

  if (missing.length === 0) {
    console.log(ok(`✓ Already in sync — no missing keys`));
    return;
  }

  // Append missing keys with empty values
  const absEnv = resolve(envPath);
  const appendContent = '\n# Added by env-template sync\n' + missing.map((k) => `${k}=`).join('\n') + '\n';
  appendFileSync(absEnv, appendContent, 'utf8');

  console.log(ok(`✓ Synced ${missing.length} missing key(s) to ${envPath}`));
  for (const key of missing) {
    console.log(dim(`  + ${key}=`));
  }
}

/**
 * AUDIT — detect sensitive-looking keys that may lack proper documentation.
 * Scans .env.example (or .env) for keys that look sensitive.
 */
function cmdAudit(flags) {
  const templatePath = flags.template || flags.env || '.env.example';
  const fallbackPath = '.env';

  let content = readEnvFile(templatePath);
  let usedPath = templatePath;

  if (content === null) {
    content = readEnvFile(fallbackPath);
    usedPath = fallbackPath;
  }

  if (content === null) {
    console.error(err(`Error: Cannot read "${templatePath}" or "${fallbackPath}"`));
    process.exit(1);
  }

  const lines = parseLines(content);
  const entries = lines.filter((l) => l.type === 'entry');

  const sensitive = entries.filter((l) => isSensitiveKey(l.key));
  const undocumented = [];

  // Check if any sensitive key lacks an adjacent comment
  const lineArr = lines;
  for (let i = 0; i < lineArr.length; i++) {
    const line = lineArr[i];
    if (line.type !== 'entry' || !isSensitiveKey(line.key)) continue;

    // Look for a comment immediately before this line
    const prevLine = i > 0 ? lineArr[i - 1] : null;
    const hasComment = prevLine && prevLine.type === 'comment';

    if (!hasComment) undocumented.push(line.key);
  }

  console.log(info(`\nAudit: ${basename(usedPath)}\n`));
  console.log(`  ${entries.length} total keys`);
  console.log(`  ${sensitive.length} sensitive-looking keys`);
  console.log(`  ${undocumented.length} sensitive keys without inline documentation\n`);

  if (sensitive.length === 0) {
    console.log(ok('✓ No sensitive-looking keys detected'));
    return;
  }

  console.log(warn('Sensitive keys found:'));
  for (const line of sensitive) {
    const keyName = line.key;
    const noDoc = undocumented.includes(keyName);
    const marker = noDoc ? warn('⚠️  no comment above') : ok('✓ documented');
    console.log(`  ${keyName.padEnd(40)} ${marker}`);
  }

  if (undocumented.length > 0) {
    console.log(warn(`\n⚠️  Add a comment above each undocumented key describing what it's for.`));
  } else {
    console.log(ok('\n✓ All sensitive keys have documentation comments.'));
  }
}

// ─── Help ─────────────────────────────────────────────────────────────────────
function showHelp() {
  console.log(`
${c.bold}env-template${c.reset} — Generate .env.example from .env, validate team sync

${c.bold}USAGE${c.reset}
  env-template <command> [options]
  envt <command> [options]            (short alias)

${c.bold}COMMANDS${c.reset}
  ${info('generate')}   Generate .env.example from .env (strips all values)
  ${info('check')}      Validate .env against .env.example
  ${info('diff')}       Show key differences between .env and .env.example
  ${info('sync')}       Add missing keys from .env.example into .env
  ${info('audit')}      Detect sensitive keys lacking documentation

${c.bold}GENERATE OPTIONS${c.reset}
  --input   <file>   Source env file         (default: .env)
  --output  <file>   Output template file    (default: .env.example)
  --no-hints         Output empty values instead of smart placeholders

${c.bold}CHECK / DIFF / SYNC OPTIONS${c.reset}
  --env      <file>  Your env file           (default: .env)
  --template <file>  Template file           (default: .env.example)

${c.bold}EXAMPLES${c.reset}
  env-template generate
  env-template generate --input .env.local --output .env.example
  env-template generate --no-hints
  env-template check
  env-template diff
  env-template sync
  env-template audit

${c.bold}SECURITY${c.reset}
  This tool strips values — it never writes actual secrets to any output.
  ${ok('Zero external dependencies.')} Node 18+.
`);
}

// ─── Entry ────────────────────────────────────────────────────────────────────
const { command, flags } = parseArgs(process.argv);

if (!command || flags.help || flags.h) {
  showHelp();
  process.exit(0);
}

switch (command) {
  case 'generate':
    cmdGenerate(flags);
    break;
  case 'check':
    cmdCheck(flags);
    break;
  case 'diff':
    cmdDiff(flags);
    break;
  case 'sync':
    cmdSync(flags);
    break;
  case 'audit':
    cmdAudit(flags);
    break;
  default:
    console.error(err(`Unknown command: "${command}"`));
    showHelp();
    process.exit(1);
}
