#!/usr/bin/env node
/**
 * openspec-validate.mjs
 *
 * Local replacement for the non-existent @openspec/cli validate command.
 *
 * What it does:
 *   1. Scans openspec/changes/ for active change directories.
 *   2. For each change directory, verifies that expected artefacts exist and
 *      are non-empty when present.
 *   3. Exits 0 on success (including empty changes/ — valid for a new repo).
 *   4. Exits 1 only on structural errors (malformed directory layout).
 *
 * Note: OpenSpec artefacts are created and maintained by the @openspec agent
 * in Copilot Chat. This script validates their presence, not their content.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const changesDir = path.join(root, 'openspec', 'changes');

const EXPECTED_ARTEFACTS = ['proposal.md', 'design.md', 'tasks.md'];
const IGNORED_ENTRIES = ['README.md', '.gitkeep'];

async function main() {
  let entries;
  try {
    entries = await fs.readdir(changesDir);
  } catch {
    console.log('openspec:validate — openspec/changes/ not found, skipping.');
    process.exit(0);
  }

  const changeDirs = (
    await Promise.all(
      entries
        .filter((e) => !IGNORED_ENTRIES.includes(e))
        .map(async (e) => {
          const full = path.join(changesDir, e);
          const stat = await fs.stat(full);
          return stat.isDirectory() ? e : null;
        }),
    )
  ).filter(Boolean);

  if (changeDirs.length === 0) {
    console.log(
      'openspec:validate — No active changes found. ' +
        'This is expected on a new repo. ' +
        'Start a feature with @openspec in Copilot Chat.',
    );
    process.exit(0);
  }

  let hasErrors = false;

  for (const changeId of changeDirs) {
    const changeDir = path.join(changesDir, changeId);
    const present = [];
    const empty = [];

    for (const artefact of EXPECTED_ARTEFACTS) {
      const filePath = path.join(changeDir, artefact);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        if (content.trim().length === 0) {
          empty.push(artefact);
        } else {
          present.push(artefact);
        }
      } catch {
        // artefact not yet created — acceptable during WIP
      }
    }

    if (empty.length > 0) {
      console.error(
        `openspec:validate [${changeId}] — empty artefacts: ${empty.join(', ')}`,
      );
      hasErrors = true;
    } else if (present.length > 0) {
      console.log(
        `openspec:validate [${changeId}] — OK (${present.join(', ')})`,
      );
    } else {
      console.warn(
        `openspec:validate [${changeId}] — no artefacts yet (WIP ok)`,
      );
    }
  }

  process.exit(hasErrors ? 1 : 0);
}

main();
