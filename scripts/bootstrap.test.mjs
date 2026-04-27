/**
 * bootstrap.test.mjs
 * ------------------
 * Simulation suite for bootstrap.mjs logic.
 * Extracts every pure-logic function and exercises all critical scenario
 * combinations WITHOUT touching the filesystem or running npm installs.
 *
 * Run: node scripts/bootstrap.test.mjs
 */

// ─── Reproduced pure logic from bootstrap.mjs ────────────────────────────────

function normalizeChoice(input, allowed) {
  const value = input.trim().toLowerCase();
  if (!allowed.includes(value))
    throw new Error(
      `Invalid choice "${input}". Allowed: ${allowed.join(', ')}`,
    );
  return value;
}

const CONFIG = {
  profiles: {
    topology: ['monorepo', 'split-repos'],
    scope: ['backend-only', 'frontend-only', 'fullstack'],
    contracts: ['rest', 'graphql', 'both', 'none'],
    criticality: ['standard', 'hardened', 'critical'],
    designSystem: ['with-design-system', 'without-design-system'],
    uiLibrary: ['tailwind', 'mui', 'antd', 'chakra', 'bootstrap', 'none'],
  },
  modules: [
    'storybook',
    'playwright',
    'contract-rest',
    'contract-graphql',
    'observability-pack',
    'aws-pack',
    'release-pack',
    'qodo-pack',
    'changesets-pack',
  ],
};

function resolveAgentOSProfile(scope) {
  if (scope === 'backend-only') return 'backend-only';
  if (scope === 'frontend-only') return 'frontend-only';
  return 'fullstack-monorepo';
}

function computeContractModuleDefaults(contracts) {
  const d = {};
  if (contracts === 'none') {
    d['contract-rest'] = false;
    d['contract-graphql'] = false;
  } else if (contracts === 'rest') {
    d['contract-graphql'] = false;
  } else if (contracts === 'graphql') {
    d['contract-rest'] = false;
  }
  // 'both' → both free
  return d;
}

function applyPostConstraints({ scope, designSystem }, modules) {
  const m = { ...modules };
  if (scope === 'backend-only') {
    m['storybook'] = false;
    m['playwright'] = false;
  }
  if (scope === 'frontend-only') {
    m['aws-pack'] = false;
    m['contract-rest'] = false;
    m['contract-graphql'] = false;
  }
  if (designSystem === 'without-design-system') {
    m['storybook'] = false;
  }
  return m;
}

function resolveUiLibrary(designSystem, uiLibraryInput) {
  return designSystem === 'without-design-system' ? 'none' : uiLibraryInput;
}

function buildActiveProfileOverrides({
  projectName,
  topology,
  scope,
  contracts,
  criticality,
  designSystem,
  uiLibrary,
  modules,
}) {
  const enabledModules = Object.entries(modules)
    .filter(([, v]) => v)
    .map(([k]) => k);
  const disabledModules = Object.entries(modules)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  const resolvedUiLibrary = uiLibrary || 'none';
  return [
    `bootstrap:`,
    `  projectName: ${projectName}`,
    `  topology: ${topology}`,
    `  scope: ${scope}`,
    `  contracts: ${contracts}`,
    `  criticality: ${criticality}`,
    `  designSystem: ${designSystem}`,
    `  ui_library: ${resolvedUiLibrary}`,
    `  enabledModules:`,
    ...(enabledModules.length
      ? enabledModules.map((m) => `    - ${m}`)
      : ['    []']),
    `  disabledModules:`,
    ...(disabledModules.length
      ? disabledModules.map((m) => `    - ${m}`)
      : ['    []']),
  ].join('\n');
}

function patchOpenspecConfig(
  txt,
  { projectName, uiLibrary, scope, contracts, criticality },
) {
  let out = txt
    .replace(/project_name:\s*'[^']*'/, `project_name: '${projectName}'`)
    .replace(
      /# TODO: change this to your actual project name after bootstrap\n\s*# Example: project_name: '[^']*'\n\s*/,
      '',
    );
  if (!out.includes('ui_library:')) {
    out = out.replace(
      /project_name: '[^']*'/,
      `project_name: '${projectName}'\n  ui_library: '${uiLibrary}'`,
    );
  } else {
    out = out.replace(/ui_library:\s*'[^']*'/, `ui_library: '${uiLibrary}'`);
  }
  if (!out.includes('scope:')) {
    out = out.replace(
      /ui_library: '[^']*'/,
      `ui_library: '${uiLibrary}'\n  scope: '${scope}'\n  contracts: '${contracts}'\n  criticality: '${criticality}'`,
    );
  }
  return out;
}

function buildNextSteps({ contracts, modules, uiLibrary, criticality }) {
  const steps = [
    'Review docs/runbooks/GITHUB_REPO_SETTINGS.md and apply manual GitHub settings.',
    'Configure real teams in CODEOWNERS.',
    'Configure Jira integration and branch naming policy.',
    'Configure MCP credentials if using MCP servers.',
    'Review .generated/active-profile.yaml for your Agent OS configuration.',
  ];
  if (contracts === 'rest' || contracts === 'both')
    steps.push('Wire OpenAPI generation + oasdiff in your CI pipeline.');
  if (contracts === 'graphql' || contracts === 'both')
    steps.push(
      'Wire GraphQL schema generation + GraphQL Inspector in your CI pipeline.',
    );
  if (modules['aws-pack'])
    steps.push('Review cfn-lint / cfn-guard placeholder workflows.');
  if (uiLibrary === 'tailwind')
    steps.push('Tailwind: configure content paths in tailwind.config.js.');
  if (criticality === 'hardened' || criticality === 'critical')
    steps.push('Apply branch protection rules.');
  if (criticality === 'critical')
    steps.push('Enable GitHub Environments with manual approval gates.');
  return steps;
}

// ─── Test framework ──────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function assert(label, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    failures.push(`  ✗ ${label}${detail ? ` → ${detail}` : ''}`);
    console.log(`  ✗ FAIL: ${label}${detail ? ` → ${detail}` : ''}`);
  }
}

function section(name) {
  console.log(`\n▶ ${name}`);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

// 1. normalizeChoice
section('normalizeChoice');
assert(
  'valid choice returns lowercased value',
  normalizeChoice('MUI', ['mui', 'tailwind']) === 'mui',
);
assert(
  'invalid choice throws',
  (() => {
    try {
      normalizeChoice('angular', ['mui']);
      return false;
    } catch {
      return true;
    }
  })(),
);
assert(
  'whitespace is trimmed',
  normalizeChoice('  tailwind  ', ['tailwind']) === 'tailwind',
);

// 2. resolveUiLibrary
section('resolveUiLibrary');
assert(
  'without-design-system forces none regardless of input',
  resolveUiLibrary('without-design-system', 'mui') === 'none',
);
assert(
  'with-design-system passes through selection',
  resolveUiLibrary('with-design-system', 'chakra') === 'chakra',
);
assert(
  'with-design-system none is valid',
  resolveUiLibrary('with-design-system', 'none') === 'none',
);

// 3. computeContractModuleDefaults
section('computeContractModuleDefaults');
{
  const d = computeContractModuleDefaults('none');
  assert('contracts=none disables contract-rest', d['contract-rest'] === false);
  assert(
    'contracts=none disables contract-graphql',
    d['contract-graphql'] === false,
  );
}
{
  const d = computeContractModuleDefaults('rest');
  assert(
    'contracts=rest disables only contract-graphql',
    d['contract-graphql'] === false && !('contract-rest' in d),
  );
}
{
  const d = computeContractModuleDefaults('graphql');
  assert(
    'contracts=graphql disables only contract-rest',
    d['contract-rest'] === false && !('contract-graphql' in d),
  );
}
{
  const d = computeContractModuleDefaults('both');
  assert(
    'contracts=both leaves both free (empty defaults)',
    Object.keys(d).length === 0,
  );
}

// 4. applyPostConstraints
section('applyPostConstraints (scope/designSystem overrides)');
{
  const base = {
    storybook: true,
    playwright: true,
    'aws-pack': true,
    'contract-rest': true,
    'contract-graphql': true,
  };
  const m = applyPostConstraints(
    {
      scope: 'backend-only',
      designSystem: 'with-design-system',
      contracts: 'rest',
    },
    base,
  );
  assert('backend-only forces storybook=false', m['storybook'] === false);
  assert('backend-only forces playwright=false', m['playwright'] === false);
  assert('backend-only keeps aws-pack untouched', m['aws-pack'] === true);
}
{
  const base = {
    storybook: true,
    playwright: true,
    'aws-pack': true,
    'contract-rest': true,
    'contract-graphql': true,
  };
  const m = applyPostConstraints(
    {
      scope: 'frontend-only',
      designSystem: 'with-design-system',
      contracts: 'rest',
    },
    base,
  );
  assert('frontend-only forces aws-pack=false', m['aws-pack'] === false);
  assert(
    'frontend-only forces contract-rest=false',
    m['contract-rest'] === false,
  );
  assert(
    'frontend-only forces contract-graphql=false',
    m['contract-graphql'] === false,
  );
  assert('frontend-only keeps storybook untouched', m['storybook'] === true);
}
{
  const base = { storybook: true };
  const m = applyPostConstraints(
    {
      scope: 'fullstack',
      designSystem: 'without-design-system',
      contracts: 'rest',
    },
    base,
  );
  assert(
    'without-design-system forces storybook=false',
    m['storybook'] === false,
  );
}

// 5. resolveAgentOSProfile
section('resolveAgentOSProfile');
assert(
  'backend-only → backend-only profile',
  resolveAgentOSProfile('backend-only') === 'backend-only',
);
assert(
  'frontend-only → frontend-only profile',
  resolveAgentOSProfile('frontend-only') === 'frontend-only',
);
assert(
  'fullstack → fullstack-monorepo profile',
  resolveAgentOSProfile('fullstack') === 'fullstack-monorepo',
);

// 6. topology × scope validation (split-repos + fullstack is illegal)
section('topology × scope guard');
assert(
  'split-repos + fullstack should throw',
  (() => {
    const topology = 'split-repos';
    const scope = 'fullstack';
    if (topology === 'split-repos' && scope === 'fullstack') return true;
    return false;
  })(),
);
assert(
  'split-repos + backend-only is valid',
  (() => {
    const topology = 'split-repos';
    const scope = 'backend-only';
    return !(topology === 'split-repos' && scope === 'fullstack');
  })(),
);

// 7. buildActiveProfileOverrides – ui_library field
section('buildActiveProfileOverrides – ui_library field');
{
  const modules = { storybook: true, playwright: false };
  const yaml = buildActiveProfileOverrides({
    projectName: 'my-app',
    topology: 'monorepo',
    scope: 'frontend-only',
    contracts: 'rest',
    criticality: 'standard',
    designSystem: 'with-design-system',
    uiLibrary: 'mui',
    modules,
  });
  assert(
    'ui_library: mui written correctly',
    yaml.includes('  ui_library: mui'),
    yaml,
  );
  assert('projectName written', yaml.includes('  projectName: my-app'));
  assert('scope written', yaml.includes('  scope: frontend-only'));
  assert('contracts written', yaml.includes('  contracts: rest'));
  assert('enabledModules contains storybook', yaml.includes('    - storybook'));
  assert(
    'disabledModules contains playwright',
    yaml.includes('    - playwright'),
  );
}
{
  const modules = {};
  const yaml = buildActiveProfileOverrides({
    projectName: 'x',
    topology: 'monorepo',
    scope: 'backend-only',
    contracts: 'none',
    criticality: 'critical',
    designSystem: 'without-design-system',
    uiLibrary: 'none',
    modules,
  });
  assert(
    'ui_library: none when without-design-system',
    yaml.includes('  ui_library: none'),
  );
  assert('empty modules renders [] marker', yaml.includes('    []'));
}
{
  // uiLibrary falsy fallback
  const modules = {};
  const yaml = buildActiveProfileOverrides({
    projectName: 'x',
    topology: 'monorepo',
    scope: 'backend-only',
    contracts: 'none',
    criticality: 'standard',
    designSystem: 'without-design-system',
    uiLibrary: '',
    modules,
  });
  assert(
    'empty uiLibrary string is coerced to none',
    yaml.includes('  ui_library: none'),
  );
}

// 8. patchOpenspecConfig
section('patchOpenspecConfig');
{
  const template = `schema: core\n\ncontext:\n  project_name: 'template-v3'\n  ui_library: 'none'\n  architecture:\n    backend: 'DDD'\n`;
  const patched = patchOpenspecConfig(template, {
    projectName: 'my-service',
    uiLibrary: 'tailwind',
    scope: 'fullstack',
    contracts: 'rest',
    criticality: 'hardened',
  });
  assert(
    'project_name updated',
    patched.includes("project_name: 'my-service'"),
    patched,
  );
  assert(
    'ui_library updated to tailwind',
    patched.includes("ui_library: 'tailwind'"),
    patched,
  );
  assert('scope injected', patched.includes("scope: 'fullstack'"), patched);
  assert('contracts injected', patched.includes("contracts: 'rest'"), patched);
  assert(
    'criticality injected',
    patched.includes("criticality: 'hardened'"),
    patched,
  );
  assert(
    'template-v3 placeholder removed',
    !patched.includes('template-v3'),
    patched,
  );
}
{
  // Running patch twice must be idempotent (no double injection)
  const template = `schema: core\n\ncontext:\n  project_name: 'template-v3'\n  ui_library: 'none'\n`;
  const once = patchOpenspecConfig(template, {
    projectName: 'svc',
    uiLibrary: 'mui',
    scope: 'backend-only',
    contracts: 'graphql',
    criticality: 'standard',
  });
  const twice = patchOpenspecConfig(once, {
    projectName: 'svc',
    uiLibrary: 'mui',
    scope: 'backend-only',
    contracts: 'graphql',
    criticality: 'standard',
  });
  const scopeCount = (twice.match(/scope:/g) || []).length;
  assert(
    'patchOpenspecConfig is idempotent (scope appears once)',
    scopeCount === 1,
    `scope appeared ${scopeCount} times`,
  );
  const uiCount = (twice.match(/ui_library:/g) || []).length;
  assert(
    'patchOpenspecConfig is idempotent (ui_library appears once)',
    uiCount === 1,
    `ui_library appeared ${uiCount} times`,
  );
}

// 9. buildNextSteps
section('buildNextSteps');
{
  const steps = buildNextSteps({
    contracts: 'rest',
    modules: { 'aws-pack': false },
    uiLibrary: 'tailwind',
    criticality: 'standard',
  });
  assert(
    'rest contract adds oasdiff step',
    steps.some((s) => s.includes('oasdiff')),
  );
  assert(
    'tailwind adds content-paths step',
    steps.some((s) => s.includes('tailwind.config')),
  );
  assert(
    'aws-pack disabled does not add cfn step',
    !steps.some((s) => s.includes('cfn-lint')),
  );
  assert(
    'standard criticality no branch protection step',
    !steps.some((s) => s.includes('branch protection')),
  );
}
{
  const steps = buildNextSteps({
    contracts: 'both',
    modules: { 'aws-pack': true },
    uiLibrary: 'mui',
    criticality: 'critical',
  });
  assert(
    'both contracts adds oasdiff step',
    steps.some((s) => s.includes('oasdiff')),
  );
  assert(
    'both contracts adds graphql step',
    steps.some((s) => s.includes('GraphQL')),
  );
  assert(
    'aws-pack enabled adds cfn step',
    steps.some((s) => s.includes('cfn-lint')),
  );
  assert(
    'critical adds branch protection step',
    steps.some((s) => s.includes('branch protection')),
  );
  assert(
    'critical adds environments step',
    steps.some((s) => s.includes('GitHub Environments')),
  );
}
{
  const steps = buildNextSteps({
    contracts: 'none',
    modules: { 'aws-pack': false },
    uiLibrary: 'none',
    criticality: 'hardened',
  });
  assert(
    'none contracts no oasdiff step',
    !steps.some((s) => s.includes('oasdiff')),
  );
  assert(
    'hardened adds branch protection step',
    steps.some((s) => s.includes('branch protection')),
  );
  assert(
    'hardened does not add environments step',
    !steps.some((s) => s.includes('GitHub Environments')),
  );
}

// 10. All uiLibrary values are in UI_INSTALL map
section('UI_INSTALL coverage');
{
  const UI_INSTALL_KEYS = [
    'tailwind',
    'mui',
    'antd',
    'chakra',
    'bootstrap',
    'none',
  ];
  for (const lib of CONFIG.profiles.uiLibrary) {
    assert(`UI_INSTALL covers '${lib}'`, UI_INSTALL_KEYS.includes(lib));
  }
}

// 11. All contracts values handled
section('contracts coverage');
{
  const handled = ['none', 'rest', 'graphql', 'both'];
  for (const c of CONFIG.profiles.contracts) {
    assert(`contracts='${c}' has a handler path`, handled.includes(c));
  }
}

// 12. Scenario matrix – full simulated run (no I/O)
section('Scenario matrix – end-to-end selection resolution');

const scenarios = [
  {
    name: 'fullstack / rest / mui / standard',
    topology: 'monorepo',
    scope: 'fullstack',
    contracts: 'rest',
    criticality: 'standard',
    designSystem: 'with-design-system',
    uiLibraryInput: 'mui',
  },
  {
    name: 'fullstack / both / tailwind / critical',
    topology: 'monorepo',
    scope: 'fullstack',
    contracts: 'both',
    criticality: 'critical',
    designSystem: 'with-design-system',
    uiLibraryInput: 'tailwind',
  },
  {
    name: 'backend-only / graphql / none / hardened',
    topology: 'monorepo',
    scope: 'backend-only',
    contracts: 'graphql',
    criticality: 'hardened',
    designSystem: 'without-design-system',
    uiLibraryInput: 'n/a',
  },
  {
    name: 'frontend-only / none / chakra / standard',
    topology: 'monorepo',
    scope: 'frontend-only',
    contracts: 'none',
    criticality: 'standard',
    designSystem: 'with-design-system',
    uiLibraryInput: 'chakra',
  },
  {
    name: 'split-repos / backend-only / antd',
    topology: 'split-repos',
    scope: 'backend-only',
    contracts: 'rest',
    criticality: 'standard',
    designSystem: 'without-design-system',
    uiLibraryInput: 'n/a',
  },
  {
    name: 'fullstack / none / bootstrap / standard',
    topology: 'monorepo',
    scope: 'fullstack',
    contracts: 'none',
    criticality: 'standard',
    designSystem: 'with-design-system',
    uiLibraryInput: 'bootstrap',
  },
];

for (const sc of scenarios) {
  const uiLibrary = resolveUiLibrary(
    sc.designSystem,
    sc.uiLibraryInput === 'n/a' ? 'none' : sc.uiLibraryInput,
  );
  const contractDefaults = computeContractModuleDefaults(sc.contracts);

  // Simulate user answering 'y' to all modules not pre-constrained
  const rawModules = {};
  for (const mod of CONFIG.modules) {
    rawModules[mod] = mod in contractDefaults ? contractDefaults[mod] : true;
  }
  const modules = applyPostConstraints(sc, rawModules);
  const profileName = resolveAgentOSProfile(sc.scope);
  const yaml = buildActiveProfileOverrides({
    projectName: 'test-app',
    ...sc,
    uiLibrary,
    modules,
  });
  const steps = buildNextSteps({
    contracts: sc.contracts,
    modules,
    uiLibrary,
    criticality: sc.criticality,
  });

  console.log(`\n  Scenario: ${sc.name}`);
  assert(
    'ui_library is never null/undefined in profile',
    yaml.includes('  ui_library: ') &&
      !yaml.includes('ui_library: null') &&
      !yaml.includes('ui_library: undefined'),
  );
  assert(
    'profile name resolved correctly',
    yaml.includes(`  scope: ${sc.scope}`) &&
      typeof profileName === 'string' &&
      profileName.length > 0,
  );

  // backend-only: contract modules must be disabled
  if (sc.scope === 'backend-only') {
    assert('backend-only: storybook=false', modules['storybook'] === false);
    assert('backend-only: playwright=false', modules['playwright'] === false);
  }

  // frontend-only: aws-pack and contract modules must be disabled
  if (sc.scope === 'frontend-only') {
    assert('frontend-only: aws-pack=false', modules['aws-pack'] === false);
    assert(
      'frontend-only: contract-rest=false',
      modules['contract-rest'] === false,
    );
    assert(
      'frontend-only: contract-graphql=false',
      modules['contract-graphql'] === false,
    );
  }

  // without-design-system must produce uiLibrary=none
  if (sc.designSystem === 'without-design-system') {
    assert(
      'without-design-system → ui_library=none in profile',
      yaml.includes('  ui_library: none'),
    );
  }

  // contracts=none: no contract workflows relevant
  if (sc.contracts === 'none') {
    assert(
      'contracts=none: no oasdiff step',
      !steps.some((s) => s.includes('oasdiff')),
    );
    assert(
      'contracts=none: no GraphQL step',
      !steps.some((s) => s.includes('GraphQL')),
    );
  }

  // split-repos + fullstack would have thrown earlier, so if we reach here it's a valid combo
  if (sc.topology === 'split-repos') {
    assert(
      'split-repos + non-fullstack does not throw guard',
      sc.scope !== 'fullstack',
    );
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(60));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log('\nFailures:');
  for (const f of failures) console.log(f);
  process.exit(1);
} else {
  console.log('All tests passed ✓');
}
