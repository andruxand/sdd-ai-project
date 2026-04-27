import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { confirm, input, select } from '@inquirer/prompts';

const root = process.cwd();
const preview = process.argv.includes('--preview');

// Guard: must run from repo root
if (
  !(await (async () => {
    try {
      await fs.access(path.join(root, '.template', 'template.config.json'));
      return true;
    } catch {
      return false;
    }
  })())
)
  throw new Error(
    'bootstrap.mjs must be run from the repository root (no .template/template.config.json found).',
  );

const config = JSON.parse(
  await fs.readFile(
    path.join(root, '.template', 'template.config.json'),
    'utf8',
  ),
);

function buildChoices(allowed, descriptions = {}) {
  return allowed.map((v) => ({
    name: v,
    value: v,
    description: descriptions[v],
  }));
}

const MODULE_DESCRIPTIONS = {
  storybook:
    'Storybook for component development and visual testing (frontend only).',
  playwright: 'End-to-end tests with Playwright.',
  'contract-rest':
    'OpenAPI spec + Redocly linting + oasdiff breaking-change detection.',
  'contract-graphql': 'GraphQL schema + graphql-inspector validation.',
  'observability-pack':
    'Structured logging, X-Ray/Datadog tracing, and CloudWatch metrics.',
  'aws-pack': 'cfn-lint, cfn-guard, and Checkov workflows for AWS IaC.',
  'release-pack': 'Automated release workflow (GitHub Releases + tagging).',
  'qodo-pack': 'Qodo AI code review integration on PRs.',
  'changesets-pack': 'Changesets for versioning and changelogs in monorepos.',
};
async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
async function removeIfExists(rel) {
  const p = path.join(root, rel);
  if (await exists(p)) await fs.rm(p, { recursive: true, force: true });
}
async function disableWorkflow(rel) {
  const full = path.join(root, rel);
  if (await exists(full)) await fs.rename(full, full + '.disabled');
}
async function replaceInFile(rel, transform) {
  const p = path.join(root, rel);
  if (!(await exists(p))) return;
  const txt = await fs.readFile(p, 'utf8');
  await fs.writeFile(p, transform(txt), 'utf8');
}
async function note(rel, content) {
  await fs.writeFile(path.join(root, '.generated', rel), content, 'utf8');
}

const topology = await select({
  message: 'Topology',
  choices: buildChoices(config.profiles.topology),
});
const scope = await select({
  message: 'Scope',
  choices: buildChoices(config.profiles.scope),
});
const contracts = await select({
  message: 'Contracts',
  choices: buildChoices(config.profiles.contracts),
});

// Derive criticality automatically — can be overridden in openspec/config.yaml later.
// Rule: frontend-only with no contracts → standard; everything else → hardened.
const criticality =
  scope === 'frontend-only' && contracts === 'none' ? 'standard' : 'hardened';
console.log(
  `Criticality: ${criticality} (auto-derived from scope=${scope}, contracts=${contracts})`,
);

const designSystem = await select({
  message: 'Design system',
  choices: buildChoices(config.profiles.designSystem),
});

const uiLibrary =
  designSystem === 'without-design-system'
    ? 'none'
    : await select({
        message: 'UI library',
        choices: buildChoices(config.profiles.uiLibrary),
      });

const projectName = await input({
  message: 'Project name (slug, e.g. my-service):',
  validate: (v) => {
    if (!v.trim()) return 'Project name cannot be empty.';
    if (/\s/.test(v.trim())) return 'Project name must not contain spaces.';
    return true;
  },
});

// Pre-constrain contract modules based on contracts answer
const contractModuleDefaults = {};
if (contracts === 'none') {
  contractModuleDefaults['contract-rest'] = false;
  contractModuleDefaults['contract-graphql'] = false;
} else if (contracts === 'rest') {
  contractModuleDefaults['contract-graphql'] = false;
} else if (contracts === 'graphql') {
  contractModuleDefaults['contract-rest'] = false;
}
// 'both' leaves both free to be toggled

const modules = {};
for (const mod of config.modules) {
  if (mod in contractModuleDefaults) {
    modules[mod] = contractModuleDefaults[mod];
    console.log(
      `Module "${mod}" auto-set to ${modules[mod]} (derived from contracts=${contracts})`,
    );
  } else {
    const modDesc = MODULE_DESCRIPTIONS[mod];
    modules[mod] = await confirm({
      message: `Enable module "${mod}"?${modDesc ? `\n  ${modDesc}` : ''}`,
      default: true,
    });
  }
}

if (topology === 'split-repos' && scope === 'fullstack') {
  throw new Error(
    'split-repos cannot be combined with fullstack. Choose backend-only or frontend-only.',
  );
}
if (scope === 'backend-only') {
  modules['storybook'] = false;
  modules['playwright'] = false;
}
if (scope === 'frontend-only') {
  modules['aws-pack'] = false;
  modules['contract-rest'] = false;
  modules['contract-graphql'] = false;
}
if (designSystem === 'without-design-system') {
  modules['storybook'] = false;
}

const selection = {
  topology,
  scope,
  contracts,
  // criticality is derived — not asked interactively
  criticality,
  designSystem,
  uiLibrary,
  projectName,
  modules,
};

if (preview) {
  console.log(JSON.stringify(selection, null, 2));
  process.exit(0);
}

await fs.mkdir(path.join(root, '.generated'), { recursive: true });
await fs.writeFile(
  path.join(root, '.generated', 'bootstrap-selection.json'),
  JSON.stringify(selection, null, 2),
  'utf8',
);

/* ── UI library installation ── */
// Packages are installed into the frontend workspace (apps/web) so they appear
// in its package.json and are resolved correctly by the monorepo.
const frontendWs = path.join(root, 'apps/web');
const hasFrontend = scope !== 'backend-only' && (await exists(frontendWs));

const UI_INSTALL = {
  mui: () => {
    console.log('Installing MUI + Emotion into apps/web...');
    execSync(
      'npm install @mui/material @mui/icons-material @emotion/react @emotion/styled',
      { stdio: 'inherit', cwd: frontendWs },
    );
  },
  tailwind: () => {
    console.log(
      'Installing Tailwind CSS v3 + PostCSS + Autoprefixer into apps/web...',
    );
    execSync('npm install -D tailwindcss postcss autoprefixer', {
      stdio: 'inherit',
      cwd: frontendWs,
    });
    execSync('npx tailwindcss init -p', { stdio: 'inherit', cwd: frontendWs });
  },
  antd: () => {
    console.log(
      'Installing Ant Design v5 (ships with TS types) into apps/web...',
    );
    execSync('npm install antd @ant-design/icons', {
      stdio: 'inherit',
      cwd: frontendWs,
    });
  },
  chakra: () => {
    // Chakra v3+ dropped framer-motion as a required peer dep
    console.log('Installing Chakra UI v3 + Emotion into apps/web...');
    execSync('npm install @chakra-ui/react @emotion/react @emotion/styled', {
      stdio: 'inherit',
      cwd: frontendWs,
    });
  },
  bootstrap: () => {
    console.log('Installing Bootstrap + React-Bootstrap into apps/web...');
    execSync('npm install bootstrap react-bootstrap', {
      stdio: 'inherit',
      cwd: frontendWs,
    });
  },
  none: () => console.log('UI library: none — skipping installation.'),
};

if (hasFrontend && uiLibrary !== 'none') {
  const installer = UI_INSTALL[uiLibrary] ?? UI_INSTALL.none;
  installer();
} else if (!hasFrontend && uiLibrary !== 'none') {
  console.warn(
    `WARNING: scope=${scope} has no apps/web workspace — skipping UI library installation.`,
  );
} else {
  UI_INSTALL.none();
}

/* ── Scope-based artifact pruning ── */

// Agents to remove per scope
const frontendOnlyAgents = [
  'backend-implementer',
  'contracts-implementer',
  'observability-implementer',
  'tester-backend',
];
const backendOnlyAgents = [
  'frontend-implementer',
  'tester-frontend',
  'e2e-tester',
];

// Skills to remove per scope
const frontendOnlySkills = [
  'serverless-endpoint',
  'backend-task-execution',
  'backend-test-hardening',
  'log-sanitization',
  'observability-hardening',
  'aws-well-architected-review',
  'contract-rest',
  'contract-graphql',
  'contract-diff-prep',
];
const backendOnlySkills = [
  'react-fsd-feature',
  'storybook-component',
  'frontend-task-execution',
  'frontend-test-hardening',
  'e2e-flow-hardening',
];

// Standards to remove per scope
const frontendOnlyStandards = [
  'aws-architecture.md',
  'aws-security.md',
  'aws-logging-observability.md',
  'serverless-v4.md',
];
const backendOnlyStandards = ['frontend-storybook.md'];

if (scope === 'backend-only') {
  for (const a of backendOnlyAgents)
    await removeIfExists(`.github/agents/${a}.agent.md`);
  for (const s of backendOnlySkills)
    await removeIfExists(`.github/skills/${s}`);
  for (const d of backendOnlyStandards)
    await removeIfExists(`docs/standards/${d}`);
}
if (scope === 'frontend-only') {
  for (const a of frontendOnlyAgents)
    await removeIfExists(`.github/agents/${a}.agent.md`);
  for (const s of frontendOnlySkills)
    await removeIfExists(`.github/skills/${s}`);
  for (const d of frontendOnlyStandards)
    await removeIfExists(`docs/standards/${d}`);
}

// Remove contract skills when contracts=none
if (contracts === 'none') {
  await removeIfExists('.github/skills/contract-rest');
  await removeIfExists('.github/skills/contract-graphql');
  await removeIfExists('.github/skills/contract-diff-prep');
  await removeIfExists('.github/agents/contracts-implementer.agent.md');
}
if (contracts === 'rest') {
  await removeIfExists('.github/skills/contract-graphql');
}
if (contracts === 'graphql') {
  await removeIfExists('.github/skills/contract-rest');
}
// 'both' keeps all contract skills and agents intact

// Remove observability prompt and skill when pack disabled
if (!modules['observability-pack']) {
  await removeIfExists('.github/prompts/observability-check.prompt.md');
  await removeIfExists('.github/skills/observability-hardening');
}

// Remove playwright config when disabled
if (!modules['playwright']) {
  await removeIfExists('apps/web/playwright.config.ts');
}

// Remove storybook skill when storybook disabled
if (!modules['storybook']) {
  await removeIfExists('.github/skills/storybook-component');
}

// Keep only the UI library skill that matches the selected uiLibrary.
// All other UI library skills are removed to keep the context clean.
{
  const uiLibrarySkillMap = {
    tailwind: 'tailwind-patterns',
    mui: 'mui-patterns',
    antd: 'antd-patterns',
    chakra: 'chakra-patterns',
    bootstrap: 'bootstrap-patterns',
    none: 'css-modules-patterns',
  };
  const allUiLibrarySkills = Object.values(uiLibrarySkillMap);
  const activeUiSkill = uiLibrarySkillMap[uiLibrary] ?? 'css-modules-patterns';
  for (const skill of allUiLibrarySkills) {
    if (skill !== activeUiSkill) {
      await removeIfExists(`.github/skills/${skill}`);
    }
  }
  console.log(
    `UI library skill: keeping '${activeUiSkill}', removed ${allUiLibrarySkills.filter((s) => s !== activeUiSkill).join(', ')}`,
  );
}

// Adapt .vscode/extensions.json by removing irrelevant extensions
await replaceInFile('.vscode/extensions.json', (txt) => {
  try {
    const ext = JSON.parse(txt);
    if (scope === 'frontend-only') {
      ext.recommendations = ext.recommendations.filter(
        (e) => !['amazonwebservices.aws-toolkit-vscode'].includes(e),
      );
    }
    if (!modules['playwright']) {
      ext.recommendations = ext.recommendations.filter(
        (e) => !['ms-playwright.playwright'].includes(e),
      );
    }
    return JSON.stringify(ext, null, 2) + '\n';
  } catch {
    return txt;
  }
});

// Adapt copilot-instructions.md by scope
if (scope === 'frontend-only') {
  await replaceInFile('.github/copilot-instructions.md', (txt) =>
    txt.replace(
      /- treat auth, permissions, PII, contracts, IAM, WAF, API Gateway, retries, tracing, API keys, and JWT as high-risk/,
      '- treat auth, permissions, PII, and sensitive data as high-risk',
    ),
  );
}

// Adapt AGENTS.md to only show relevant routing
if (scope === 'backend-only') {
  await replaceInFile('AGENTS.md', (txt) =>
    txt
      .replace(/- `frontend-implementer`\n/g, '')
      .replace(/- `tester-frontend`\n/g, '')
      .replace(/- `e2e-tester`\n/g, '')
      .replace(/### Standard frontend[\s\S]*?(?=###|## )/, ''),
  );
}
if (scope === 'frontend-only') {
  await replaceInFile('AGENTS.md', (txt) =>
    txt
      .replace(/- `backend-implementer`\n/g, '')
      .replace(/- `contracts-implementer`\n/g, '')
      .replace(/- `observability-implementer`\n/g, '')
      .replace(/- `tester-backend`\n/g, '')
      .replace(/### Standard backend[\s\S]*?(?=###|## )/, ''),
  );
}

/* scope materialization */
if (scope === 'backend-only') {
  await removeIfExists('apps/web');
  await disableWorkflow('.github/workflows/playwright.yml');
  await disableWorkflow('.github/workflows/lighthouse.yml');
}
if (scope === 'frontend-only') {
  await removeIfExists('services/api');
  await disableWorkflow('.github/workflows/checkov.yml');
  await disableWorkflow('.github/workflows/cfn-lint.yml');
  await disableWorkflow('.github/workflows/cfn-guard.yml');
}

/* topology */
if (topology === 'split-repos') {
  await note(
    'split-repos.md',
    '# Split repos mode\nUse this template separately for frontend and backend repositories.\n',
  );
  await replaceInFile(
    'README.md',
    (txt) =>
      txt +
      '\n\n## Split repos note\nThis instance was materialized for a split-repos target.\n',
  );
}

/* contracts materialization */
if (contracts === 'none') {
  await removeIfExists('packages/contracts');
  await disableWorkflow('.github/workflows/contracts-rest.yml');
  await disableWorkflow('.github/workflows/contracts-graphql.yml');
}
if (contracts === 'rest') {
  await disableWorkflow('.github/workflows/contracts-graphql.yml');
  await removeIfExists('packages/contracts/graphql');
}
if (contracts === 'graphql') {
  await disableWorkflow('.github/workflows/contracts-rest.yml');
  await removeIfExists('packages/contracts/rest');
  await removeIfExists('packages/contracts/redocly.yaml');
}

/* design system and storybook */
if (designSystem === 'without-design-system') {
  await removeIfExists('packages/shared/ui');
}
if (!modules['storybook']) {
  await removeIfExists('apps/web/.storybook');
  await removeIfExists('apps/web/src/components/Button.stories.tsx');
  await replaceInFile('apps/web/package.json', (txt) =>
    txt
      .replace(/,\s*"storybook":\s*"storybook dev -p 6006"/, '')
      .replace(/,\s*"storybook:build":\s*"storybook build"/, ''),
  );
}

/* modules */
if (!modules['playwright'])
  await disableWorkflow('.github/workflows/playwright.yml');
if (!modules['contract-rest'])
  await disableWorkflow('.github/workflows/contracts-rest.yml');
if (!modules['contract-graphql'])
  await disableWorkflow('.github/workflows/contracts-graphql.yml');
if (!modules['aws-pack']) {
  await disableWorkflow('.github/workflows/checkov.yml');
  await disableWorkflow('.github/workflows/cfn-lint.yml');
  await disableWorkflow('.github/workflows/cfn-guard.yml');
}
if (!modules['changesets-pack']) {
  await note('changesets.md', '# Changesets disabled\n');
}
if (!modules['qodo-pack']) {
  await note('qodo.md', '# Qodo pack disabled\n');
}
if (!modules['release-pack']) {
  await disableWorkflow('.github/workflows/release.yml');
  await note('release-pack.md', '# Release pack disabled\n');
}
if (!modules['observability-pack']) {
  await note('observability-pack.md', '# Observability pack disabled\n');
}

/* criticality note */
let criticalityNote = '# Criticality\n';
if (criticality === 'standard') criticalityNote += '- Standard controls.\n';
if (criticality === 'hardened')
  criticalityNote +=
    '- Hardened: stricter branch protection, required reviewers, and manual release controls.\n';
if (criticality === 'critical')
  criticalityNote +=
    '- Critical: strongest branch protection, environments, CODEOWNERS, release checks, and rollback discipline.\n';
await note('criticality.md', criticalityNote);

/* ── Agent OS active profile ── */
function resolveAgentOSProfile(sel) {
  if (sel.scope === 'backend-only') return 'backend-only';
  if (sel.scope === 'frontend-only') return 'frontend-only';
  return 'fullstack-monorepo';
}

const profileName = resolveAgentOSProfile(selection);
const profileSource = path.join(
  root,
  'agent-os',
  'profiles',
  `${profileName}.yaml`,
);
if (await exists(profileSource)) {
  let profileContent = await fs.readFile(profileSource, 'utf8');
  // Patch modules section to reflect actual selections
  const enabledModules = Object.entries(modules)
    .filter(([, v]) => v)
    .map(([k]) => k);
  const disabledModules = Object.entries(modules)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  const resolvedUiLibrary = uiLibrary || 'none';
  profileContent += `\n# ── Bootstrap overrides (auto-generated) ──\nbootstrap:\n  projectName: ${projectName}\n  topology: ${topology}\n  scope: ${scope}\n  contracts: ${contracts}\n  criticality: ${criticality}\n  designSystem: ${designSystem}\n  ui_library: ${resolvedUiLibrary}\n  enabledModules:\n${enabledModules.map((m) => `    - ${m}`).join('\n') || '    []'}\n  disabledModules:\n${disabledModules.map((m) => `    - ${m}`).join('\n') || '    []'}\n`;
  await fs.writeFile(
    path.join(root, '.generated', 'active-profile.yaml'),
    profileContent,
    'utf8',
  );
  console.log(
    `Agent OS profile: ${profileName} → .generated/active-profile.yaml`,
  );
} else {
  console.warn(
    `WARNING: Agent OS profile "${profileName}" not found at ${profileSource}. Skipping profile generation.`,
  );
}

const nextSteps = [
  'Review docs/runbooks/GITHUB_REPO_SETTINGS.md and apply manual GitHub settings.',
  'Configure real teams in CODEOWNERS.',
  'Configure Jira integration and branch naming policy.',
  'Configure MCP credentials if using MCP servers.',
  'Review .generated/active-profile.yaml for your Agent OS configuration.',
];
if (contracts === 'rest' || contracts === 'both')
  nextSteps.push('Wire OpenAPI generation + oasdiff in your CI pipeline.');
if (contracts === 'graphql' || contracts === 'both')
  nextSteps.push(
    'Wire GraphQL schema generation + GraphQL Inspector in your CI pipeline.',
  );
if (modules['aws-pack'])
  nextSteps.push(
    'Review cfn-lint / cfn-guard placeholder workflows and connect them to your deploy packaging or templates.',
  );
if (uiLibrary === 'tailwind')
  nextSteps.push(
    'Tailwind: configure content paths in tailwind.config.js (or CSS @source in v4) to match your src glob.',
  );
if (criticality === 'hardened' || criticality === 'critical')
  nextSteps.push(
    'Apply branch protection rules and required reviewers as described in docs/governance/RISK_MATRIX.md.',
  );
if (criticality === 'critical')
  nextSteps.push(
    'Enable GitHub Environments with manual approval gates for production deployments.',
  );
await note('next-steps.md', nextSteps.map((x) => `- ${x}`).join('\n') + '\n');

/* ── Patch openspec/config.yaml with all bootstrap selections ── */
await replaceInFile('openspec/config.yaml', (txt) => {
  let out = txt
    .replace(/project_name:\s*'[^']*'/, `project_name: '${projectName}'`)
    .replace(
      /# TODO: change this to your actual project name after bootstrap\n\s*# Example: project_name: '[^']*'\n\s*/,
      '',
    );
  // Inject ui_library under project_name if not present
  if (!out.includes('ui_library:')) {
    out = out.replace(
      /project_name: '[^']*'/,
      `project_name: '${projectName}'\n  ui_library: '${uiLibrary}'`,
    );
  } else {
    out = out.replace(/ui_library:\s*'[^']*'/, `ui_library: '${uiLibrary}'`);
  }
  // Inject scope, contracts, criticality so agents can read them
  if (!out.includes('scope:')) {
    out = out.replace(
      /ui_library: '[^']*'/,
      `ui_library: '${uiLibrary}'\n  scope: '${scope}'\n  contracts: '${contracts}'\n  criticality: '${criticality}'`,
    );
  }
  return out;
});
console.log(
  `openspec/config.yaml → project_name: '${projectName}', ui_library: '${uiLibrary}', scope: '${scope}', contracts: '${contracts}', criticality: '${criticality}'`,
);

console.log('Bootstrap complete.');
console.log(JSON.stringify(selection, null, 2));
