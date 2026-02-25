#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Read the entire JSON input from stdin
let input = '';
const chunks = [];
const fd = fs.openSync('/dev/stdin', 'r');
const buf = Buffer.alloc(4096);
let bytesRead;
while ((bytesRead = fs.readSync(fd, buf, 0, buf.length)) > 0) {
  chunks.push(buf.slice(0, bytesRead));
}
fs.closeSync(fd);
input = Buffer.concat(chunks).toString('utf8');

const parsed = JSON.parse(input);
const hookEvent = parsed.hookEventName;
const sessionId = parsed.sessionId;

// Date prefix: DD-MM-YYYY
const now = new Date();
const datePrefix = [
  String(now.getDate()).padStart(2, '0'),
  String(now.getMonth() + 1).padStart(2, '0'),
  now.getFullYear(),
].join('-');
const dateDir = path.join('logs', datePrefix);

// Map session ID to an auto-incrementing number
fs.mkdirSync(dateDir, { recursive: true });
const trackingFile = path.join(dateDir, '.session-map');
if (!fs.existsSync(trackingFile)) {
  fs.writeFileSync(trackingFile, '');
}

const trackingContent = fs.readFileSync(trackingFile, 'utf8');
const lines = trackingContent.split('\n').filter(Boolean);

let sessionNum = null;
for (const line of lines) {
  const [sid, num] = line.split('=');
  if (sid === sessionId) {
    sessionNum = parseInt(num, 10);
    break;
  }
}

if (sessionNum === null) {
  const lastLine = lines[lines.length - 1];
  const lastNum = lastLine ? parseInt(lastLine.split('=')[1], 10) : 0;
  sessionNum = lastNum + 1;
  fs.appendFileSync(trackingFile, `${sessionId}=${sessionNum}\n`);
}

const sessionDir = path.join(dateDir, String(sessionNum));

// Log input
const inputLogDir = path.join(sessionDir, 'input');
fs.mkdirSync(inputLogDir, { recursive: true });
fs.appendFileSync(path.join(inputLogDir, `${hookEvent}.log`), input + '\n');
fs.appendFileSync(path.join(sessionDir, 'global.log'), input + '\n');

// Resolve config file path relative to repo root
let repoRoot;
try {
  repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
} catch {
  repoRoot = path.resolve(__dirname, '..', '..');
}

let configFile = null;
for (const name of ['config.jsonc', 'config.json']) {
  const candidate = path.join(repoRoot, name);
  if (fs.existsSync(candidate)) {
    configFile = candidate;
    break;
  }
}

if (!configFile) {
  process.stderr.write(`Config file not found in: ${repoRoot}\n`);
  process.exit(0);
}

// Read config, stripping single-line // comments for jsonc support
const rawConfig = fs.readFileSync(configFile, 'utf8');
const strippedConfig = rawConfig.replace(/\/\/.*$/gm, '');
const config = JSON.parse(strippedConfig);

const eventConfig = config[hookEvent];
if (!eventConfig || (typeof eventConfig === 'object' && Object.keys(eventConfig).length === 0)) {
  process.exit(0);
}

const exitCode = eventConfig.exitCode ?? 0;
const stdout = eventConfig.stdout ?? null;
const stderr = eventConfig.stderr ?? '';

// Log output
const outputLogDir = path.join(sessionDir, 'output');
fs.mkdirSync(outputLogDir, { recursive: true });
const eventConfigStr = JSON.stringify(eventConfig);
fs.appendFileSync(path.join(outputLogDir, `${hookEvent}.log`), eventConfigStr + '\n');
fs.appendFileSync(path.join(sessionDir, 'global.log'), eventConfigStr + '\n');

// Emit stderr
if (stderr) {
  process.stderr.write(stderr);
}

// Emit stdout JSON
if (stdout && typeof stdout === 'object' && Object.keys(stdout).length > 0) {
  process.stdout.write(JSON.stringify(stdout));
}

process.exit(exitCode);
