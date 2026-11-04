#!/usr/bin/env node
// Validates every skill, agent and command: frontmatter shape, required sections, safety wording,
// banned marketing claims and secret-looking strings. Zero dependencies. Exit 1 on any problem.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SECRET_PATTERNS } from '../lib/preflight.mjs';

const ROOT = process.env.BH_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const err = (f, m) => errors.push(`${f}: ${m}`);
const BANNED = [/24\/7/i, /\bguarantee/i, /money[- ]back/i, /\bunlimited\b/i, /free hosting/i, /25k hours/i];

// Minimal strict frontmatter parser: top-level `key: value` and one level of nested `key:` maps.
export function parseFrontmatter(text, file) {
  if (!text.startsWith('---\n')) { err(file, 'must start with --- frontmatter'); return null; }
  const end = text.indexOf('\n---\n', 4);
  if (end < 0) { err(file, 'frontmatter not closed with ---'); return null; }
  const fm = {}; let parent = null;
  for (const [i, line] of text.slice(4, end).split('\n').entries()) {
    if (!line.trim()) continue;
    const nested = /^ {2}([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    const top = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    const m = top || nested;
    if (!m) { err(file, `frontmatter line ${i + 2} is not "key: value": ${line}`); continue; }
    let [, k, v] = m;
    if (/^".*"$/.test(v)) { try { v = JSON.parse(v); } catch { err(file, `bad quoted value for ${k}`); } }
    else if (/: |\s#/.test(v)) err(file, `unquoted value for "${k}" contains ": " or " #" (invalid YAML)`);
    else if (/^['"&*!|>%@`{[]/.test(v)) err(file, `value for "${k}" starts with a YAML special character; quote it`);
    if (top) { if (k in fm) err(file, `duplicate key ${k}`); fm[k] = v === '' ? {} : v; parent = v === '' ? k : null; }
    else if (parent) fm[parent][k] = v;
    else err(file, `unexpected indentation on line ${i + 2}`);
  }
  return { fm, body: text.slice(end + 5) };
}

function common(file, text) {
  for (const re of BANNED) if (re.test(text)) err(file, `banned claim matches ${re}`);
  for (const p of SECRET_PATTERNS) if (p.re.test(text)) err(file, `contains a ${p.label}-shaped string`);
  if (/\t/.test(text)) err(file, 'contains tab characters');
}

// Skills
const skillsDir = join(ROOT, 'skills');
const skills = readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
if (skills.length < 7) err('skills/', `expected at least 7 skills, found ${skills.length}`);
for (const name of skills) {
  const file = `skills/${name}/SKILL.md`;
  if (!existsSync(join(ROOT, file))) { err(file, 'missing'); continue; }
  const text = readFileSync(join(ROOT, file), 'utf8');
  common(file, text);
  const parsed = parseFrontmatter(text, file);
  if (!parsed) continue;
  const { fm, body } = parsed;
  const allowed = new Set(['name', 'description', 'license', 'metadata', 'allowed-tools', 'compatibility']);
  for (const k of Object.keys(fm)) if (!allowed.has(k)) err(file, `frontmatter key "${k}" is not in the Agent Skills spec`);
  if (fm.name !== name) err(file, `name "${fm.name}" must equal folder name "${name}"`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fm.name || '') || (fm.name || '').length > 64) err(file, 'name must be lowercase-hyphenated, max 64 chars');
  const d = fm.description || '';
  if (d.length < 80 || d.length > 1024) err(file, `description must be 80-1024 chars (is ${d.length})`);
  if (!/Use when/.test(d)) err(file, 'description must say when to use it ("Use when ...")');
  if (fm.license !== 'MIT') err(file, 'license must be MIT');
  if (!fm.metadata || fm.metadata.origin !== 'BlitzHash') err(file, 'metadata.origin must be BlitzHash (never relabel ECC skills)');
  for (const h of ['## When to use', '## Steps', '## Safety rules', '## Pairs with ECC']) if (!body.includes(h)) err(file, `missing section "${h}"`);
  if (!/dry run/i.test(body)) err(file, 'must require a dry run before changes');
  if (!/explicit "yes"/.test(body)) err(file, 'must require explicit confirmation ("yes") before changes');
  if (!/environment/.test(body) || !/scoped|Scoped/.test(body)) err(file, 'must say tokens are scoped and come from the user\'s environment');
  if (!/github\.com\/affaan-m\/ECC/.test(body)) err(file, 'must link ECC in "Pairs with ECC"');
  if (!/^1\. /m.test(body.split('## Steps')[1] || '')) err(file, 'Steps must be a numbered list');
}

// Agents and commands
for (const [dir, need] of [['agents', ['name', 'description']], ['commands', ['description']]]) {
  for (const f of readdirSync(join(ROOT, dir)).filter((x) => x.endsWith('.md'))) {
    const file = `${dir}/${f}`;
    const text = readFileSync(join(ROOT, file), 'utf8');
    common(file, text);
    const parsed = parseFrontmatter(text, file);
    if (!parsed) continue;
    for (const k of need) if (!parsed.fm[k]) err(file, `missing frontmatter ${k}`);
    if (dir === 'agents' && parsed.fm.name !== f.replace(/\.md$/, '')) err(file, 'agent name must match file name');
    if (!/yes/.test(parsed.body)) err(file, 'must require the user\'s "yes" before changes');
  }
}

// Every skill named in agents/commands/README must exist
for (const f of ['README.md', 'AGENTS.md', ...readdirSync(join(ROOT, 'agents')).map((x) => `agents/${x}`)]) {
  if (!existsSync(join(ROOT, f))) continue;
  const t = readFileSync(join(ROOT, f), 'utf8');
  for (const s of skills) if (f === 'README.md' && !t.includes(`\`${s}\``)) err(f, `does not document skill ${s}`);
}

if (errors.length) { console.error(errors.map((e) => `✗ ${e}`).join('\n')); console.error(`\n${errors.length} problem(s).`); process.exit(1); }
console.log(`✓ ${skills.length} skills, ${readdirSync(join(ROOT, 'agents')).length} agents, ${readdirSync(join(ROOT, 'commands')).length} commands valid`);
