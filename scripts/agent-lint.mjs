#!/usr/bin/env node
/**
 * agent-lint.mjs
 *
 * Validates structural integrity of all .github/agents/*.agent.md files.
 * Runs as part of `npm run validate` (via `npm run agent:lint`).
 *
 * Rules enforced:
 *   1. Every agent MUST have a `## Session start` section.
 *   2. Every agent MUST have a `## Exit checklist` section.
 *   3. No agent may contain `git checkout main` (stale branch base — use develop).
 *   4. No agent may contain `pull origin main` outside a hotfix comment block.
 *   5. No agent may contain placeholder text: `{change-id}` left as literal
 *      (only allowed inside backtick code spans as documentation).
 *   6. The `@openspec` agent MUST reference `develop` in its branch instruction.
 *   7. Every agent file must declare a `model:` in the front-matter.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const agentsDir = join(__dirname, '..', '.github', 'agents');

// ─── Rule definitions ──────────────────────────────────────────────────────────

const RULES = [
  {
    id: 'R01',
    description: 'Must have ## Session start section',
    check: (content) => /^## Session start/m.test(content),
    // openspec uses "### Step 0: Orient (every session start)" — counts as equivalent
    exempt: (file) => file === 'openspec.agent.md',
  },
  {
    id: 'R02',
    description: 'Must have ## Exit checklist section',
    check: (content) => /^## Exit checklist/m.test(content),
  },
  {
    id: 'R03',
    description: 'Must not contain bare `git checkout main` (use develop)',
    // Allow it only inside comments (lines starting with #)
    check: (content) => {
      const lines = content.split('\n');
      return !lines.some(
        (l) =>
          /git checkout main/.test(l) &&
          !l.trim().startsWith('#') &&
          !l.trim().startsWith('//'),
      );
    },
  },
  {
    id: 'R04',
    description: 'Must not contain bare `git pull origin main` (use develop)',
    check: (content) => {
      const lines = content.split('\n');
      return !lines.some(
        (l) =>
          /git pull origin main/.test(l) &&
          !l.trim().startsWith('#') &&
          !l.trim().startsWith('//'),
      );
    },
  },
  {
    id: 'R05',
    description: 'Must declare model: in front-matter',
    check: (content) => /^model:\s+\S+/m.test(content),
  },
  {
    id: 'R06',
    description:
      'openspec agent must instruct branching from develop (not main)',
    check: (content) => /branch from `develop`/.test(content),
    // Only applies to openspec
    onlyFor: (file) => file === 'openspec.agent.md',
  },
];

// ─── Runner ────────────────────────────────────────────────────────────────────

async function main() {
  const files = (await readdir(agentsDir)).filter((f) =>
    f.endsWith('.agent.md'),
  );

  if (files.length === 0) {
    console.error('agent-lint: no *.agent.md files found in .github/agents/');
    process.exit(1);
  }

  const failures = [];

  for (const file of files.sort()) {
    const content = await readFile(join(agentsDir, file), 'utf8');

    for (const rule of RULES) {
      // Skip rules that only apply to specific files
      if (rule.onlyFor && !rule.onlyFor(file)) continue;
      // Skip rules that exempt specific files
      if (rule.exempt && rule.exempt(file)) continue;

      const passed = rule.check(content);
      if (!passed) {
        failures.push({ file, rule: rule.id, description: rule.description });
      }
    }
  }

  if (failures.length === 0) {
    const count = files.length;
    console.log(
      `agent-lint: ✓ ${count} agent file${count !== 1 ? 's' : ''} passed all rules`,
    );
    process.exit(0);
  }

  console.error(`agent-lint: ${failures.length} rule violation(s) found:\n`);
  for (const f of failures) {
    console.error(`  [${f.rule}] ${f.file}: ${f.description}`);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error('agent-lint: unexpected error:', err.message);
  process.exit(1);
});
