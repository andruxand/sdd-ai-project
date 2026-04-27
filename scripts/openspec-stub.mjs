#!/usr/bin/env node
/**
 * openspec-stub.mjs
 *
 * Replaces openspec CLI subcommands that are not available via a published package.
 * All OpenSpec management (init, profile, update, status) is handled by the
 * @openspec agent in Copilot Chat — not by a CLI.
 *
 * This script exists to satisfy package.json script references and to guide
 * developers toward the correct workflow instead of failing silently.
 */

const cmd = process.argv[2] ?? '(none)';

const messages = {
  init: [
    'openspec:init — No CLI setup required.',
    '',
    'OpenSpec is agent-driven. To initialize a new change:',
    '  1. Open Copilot Chat in VS Code (Ctrl+Shift+I / Cmd+Shift+I)',
    '  2. Type: @openspec start a new change for [your Jira key or description]',
    '  3. The agent will create openspec/changes/<id>/{proposal,design,tasks}.md',
    '',
    'Project config: review and update openspec/config.yaml (project_name, architecture).',
  ],
  profile: [
    'openspec:profile — No CLI setup required.',
    '',
    'The active bootstrap profile is already written to .generated/active-profile.yaml.',
    'To change architecture or project metadata, edit openspec/config.yaml directly.',
  ],
  update: [
    'openspec:update — No CLI update required.',
    '',
    'OpenSpec artefacts (proposal.md, design.md, tasks.md) are updated by the @openspec',
    'agent during the development flow. No manual CLI step is needed.',
  ],
  status: ['openspec:status — listing active changes:', ''],
};

async function main() {
  if (cmd === 'status') {
    // Print status by scanning changes directory
    const { default: fs } = await import('node:fs/promises');
    const { default: path } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const root = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '..',
    );
    const changesDir = path.join(root, 'openspec', 'changes');
    try {
      const entries = await fs.readdir(changesDir);
      const dirs = (
        await Promise.all(
          entries
            .filter((e) => !['README.md', '.gitkeep'].includes(e))
            .map(async (e) => {
              const stat = await fs.stat(path.join(changesDir, e));
              return stat.isDirectory() ? e : null;
            }),
        )
      ).filter(Boolean);
      console.log(...messages.status);
      if (dirs.length === 0) {
        console.log('  (no active changes)');
      } else {
        dirs.forEach((d) => console.log(`  - ${d}`));
      }
    } catch {
      console.log('  openspec/changes/ not found.');
    }
    return;
  }

  const lines = messages[cmd];
  if (lines) {
    lines.forEach((l) => console.log(l));
  } else {
    console.log(`openspec:${cmd} — unknown command.`);
    console.log('Available: init, profile, update, status, validate');
    console.log('');
    console.log(
      'All OpenSpec operations use the @openspec agent in Copilot Chat.',
    );
    process.exit(1);
  }
}

main();
