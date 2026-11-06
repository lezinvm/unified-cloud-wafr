/**
 * GCP ALL-PROJECTS, ALL-SERVICES fetcher via the OFFICIAL gcloud-mcp server.
 *
 * 1. Lists every project the authenticated account can see.
 * 2. For each project, fetches read-only resource data for every service in
 *    the catalog-relevant FETCH_PLAN (IAM, compute, network, storage, DB,
 *    GKE, KMS, logging, pubsub, bigquery, secrets, functions, run, dns, ...).
 * 3. Collects everything into one combined JSON result.
 *
 * Fetch-only (no pass/fail logic, no writes). The scanner/checks read the output.
 *
 * Usage:
 *   node gcp_fetch_all.mjs [--project P]   # single project (skips discovery)
 *   node gcp_fetch_all.mjs --all           # every visible project
 *   node gcp_fetch_all.mjs --out file.json
 */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
function argVal(flag, def) {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def;
}
const SINGLE_PROJECT = argVal('--project', null);
const OUT = argVal('--out', 'gcp_fetch_result.json');

const GCLOUD_BIN = process.env.LOCALAPPDATA
  ? process.env.LOCALAPPDATA + '\\Google\\Cloud SDK\\google-cloud-sdk\\bin'
  : '';
const env = { ...process.env, PATH: process.env.PATH + (GCLOUD_BIN ? ';' + GCLOUD_BIN : '') };

/**
 * Service fetch plan. Each entry: key + gcloud args (read-only).
 * `global:true` means the command is not per-project-scoped the same way
 * (we still pass --project). Extend this list as the catalog grows.
 */
const FETCH_PLAN = [
  // IAM & org
  { key: 'iam_service_accounts', args: ['iam', 'service-accounts', 'list'] },
  { key: 'iam_roles_custom',     args: ['iam', 'roles', 'list'] },
  { key: 'project_iam_policy',   args: ['projects', 'get-iam-policy'], iamPolicy: true },

  // Compute
  { key: 'compute_instances',    args: ['compute', 'instances', 'list'] },
  { key: 'compute_disks',        args: ['compute', 'disks', 'list'] },
  { key: 'compute_images',       args: ['compute', 'images', 'list', '--no-standard-images'] },
  { key: 'compute_snapshots',    args: ['compute', 'snapshots', 'list'] },
  { key: 'compute_instance_templates', args: ['compute', 'instance-templates', 'list'] },

  // Network
  { key: 'networks_vpc',         args: ['compute', 'networks', 'list'] },
  { key: 'subnets',              args: ['compute', 'networks', 'subnets', 'list'] },
  { key: 'firewall_rules',       args: ['compute', 'firewall-rules', 'list'] },
  { key: 'routes',               args: ['compute', 'routes', 'list'] },
  { key: 'addresses_static_ip',  args: ['compute', 'addresses', 'list'] },
  { key: 'forwarding_rules',     args: ['compute', 'forwarding-rules', 'list'] },
  { key: 'ssl_policies',         args: ['compute', 'ssl-policies', 'list'] },
  { key: 'target_proxies_https', args: ['compute', 'target-https-proxies', 'list'] },
  { key: 'vpn_tunnels',          args: ['compute', 'vpn-tunnels', 'list'] },
  { key: 'routers',              args: ['compute', 'routers', 'list'] },

  // Storage
  { key: 'storage_buckets',      args: ['storage', 'buckets', 'list'] },

  // Databases
  { key: 'sql_instances',        args: ['sql', 'instances', 'list'] },
  { key: 'spanner_instances',    args: ['spanner', 'instances', 'list'] },
  { key: 'bigtable_instances',   args: ['bigtable', 'instances', 'list'] },
  // NOTE: redis needs a region; '--region=-' can hang. Use a fixed region.
  { key: 'redis_instances',      args: ['redis', 'instances', 'list', '--region=us-central1'] },
  { key: 'firestore_databases',  args: ['firestore', 'databases', 'list'] },

  // Analytics / warehouse — 'gcloud alpha bq' can trigger an interactive
  // component-install prompt that hangs; omitted here. Add once the alpha
  // component is pre-installed in the scanner environment.

  // Load balancing / edge (list is global)
  { key: 'backend_services',     args: ['compute', 'backend-services', 'list'] },
  { key: 'url_maps',             args: ['compute', 'url-maps', 'list'] },
  { key: 'backend_buckets',      args: ['compute', 'backend-buckets', 'list'] },
  { key: 'security_policies',    args: ['compute', 'security-policies', 'list'] }, // Cloud Armor
  { key: 'instance_groups_managed', args: ['compute', 'instance-groups', 'managed', 'list'] },

  // Kubernetes & containers
  { key: 'gke_clusters',         args: ['container', 'clusters', 'list'] },
  { key: 'artifact_repos',       args: ['artifacts', 'repositories', 'list'] },

  // Serverless
  { key: 'cloud_functions',      args: ['functions', 'list'] },
  { key: 'cloud_run_services',   args: ['run', 'services', 'list'] },
  { key: 'app_engine_services',  args: ['app', 'services', 'list'] },

  // Messaging / streaming
  { key: 'pubsub_topics',        args: ['pubsub', 'topics', 'list'] },
  { key: 'pubsub_subscriptions', args: ['pubsub', 'subscriptions', 'list'] },

  // Secrets
  { key: 'secrets',              args: ['secrets', 'list'] },

  // DNS / certs
  { key: 'dns_zones',            args: ['dns', 'managed-zones', 'list'] },
  { key: 'ssl_certificates',     args: ['compute', 'ssl-certificates', 'list'] },
  { key: 'certificate_manager',  args: ['certificate-manager', 'certificates', 'list'] },

  // Governance / contacts / org policy
  { key: 'essential_contacts',   args: ['essential-contacts', 'list'] },
  { key: 'org_policies',         args: ['org-policies', 'list'] },

  // Analytics — BigQuery omitted: only `gcloud alpha bq` exists and it can
  // trigger an interactive component-install prompt that hangs. Left UNKNOWN
  // in checks until the alpha component is pre-installed in the scanner env.

  // CI/CD
  { key: 'build_triggers',       args: ['builds', 'triggers', 'list'] },
  { key: 'source_repos',         args: ['source', 'repos', 'list'] },

  // Logging / monitoring
  { key: 'logging_sinks',        args: ['logging', 'sinks', 'list'] },
  { key: 'logging_metrics',      args: ['logging', 'metrics', 'list'] },

  // Services / APIs enabled
  { key: 'services_enabled',     args: ['services', 'list', '--enabled'] },
];

// KMS is location-scoped: keyrings live in regions/global. We discover
// keyrings across common locations, then list keys (with rotation/IAM-relevant
// metadata) under each ring. Output stored under service key 'kms_crypto_keys'.
const KMS_LOCATIONS = [
  'global', 'us', 'us-central1', 'us-east1', 'us-east4', 'us-west1',
  'europe', 'europe-west1', 'asia', 'asia-south1', 'asia-southeast1',
];

// ---- MCP plumbing ----
const srv = spawn('npx', ['-y', '@google-cloud/gcloud-mcp'], {
  env, shell: true, stdio: ['pipe', 'pipe', 'pipe'],
});
let buf = '';
const pending = new Map();
let nextId = 1;
function send(method, params) {
  const id = nextId++;
  srv.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  return new Promise((res) => pending.set(id, res));
}
function notify(method, params) {
  srv.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
}
srv.stdout.on('data', (d) => {
  buf += d.toString();
  let idx;
  while ((idx = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    } catch {}
  }
});
function extractText(call) {
  const c = call.result?.content;
  if (Array.isArray(c)) return c.map(x => x.text ?? '').join('\n');
  if (call.error) return 'MCP_ERROR: ' + JSON.stringify(call.error);
  return JSON.stringify(call.result ?? {});
}

const CALL_TIMEOUT_MS = 45000; // no single gcloud call may exceed this

async function runGcloud(args) {
  // '--quiet' disables interactive prompts (e.g. component-install) so a call
  // can never block waiting for stdin.
  const finalArgs = args.includes('--quiet') ? args : [...args, '--quiet'];
  const callP = send('tools/call', { name: 'run_gcloud_command', arguments: { args: finalArgs } });
  const timeoutP = new Promise((res) => setTimeout(() => res({ __timeout: true }), CALL_TIMEOUT_MS));
  const call = await Promise.race([callP, timeoutP]);
  if (call.__timeout) return { ok: false, error: 'TIMEOUT after ' + CALL_TIMEOUT_MS + 'ms' };
  const text = extractText(call);
  try { return { ok: true, data: JSON.parse(text) }; }
  catch { return { ok: false, error: text.slice(0, 250) }; }
}

async function fetchService(entry, project) {
  const args = [...entry.args];
  if (entry.iamPolicy) args.push(project);          // projects get-iam-policy PROJECT
  if (!args.some(a => a.startsWith('--project='))) args.push(`--project=${project}`);
  if (!args.some(a => a.startsWith('--format='))) args.push('--format=json');
  const r = await runGcloud(args);
  if (r.ok) {
    const count = Array.isArray(r.data) ? r.data.length : (r.data && typeof r.data === 'object' ? 1 : 0);
    return { ok: true, count, data: r.data };
  }
  return { ok: false, error: r.error, data: null };
}

async function listProjects() {
  const r = await runGcloud(['projects', 'list', '--format=json']);
  if (r.ok && Array.isArray(r.data)) return r.data.map(p => p.projectId).filter(Boolean);
  return [];
}

/**
 * KMS fetch: keyrings are location-scoped. Discover rings across KMS_LOCATIONS,
 * then list crypto keys (which carry rotationPeriod, nextRotationTime,
 * destroyScheduledDuration, purpose) under each ring. Returns a flat list of
 * keys annotated with their keyring + location so checks can evaluate them.
 */
async function fetchKms(project) {
  const keys = [];
  // 1. Discover keyrings across all locations in parallel.
  const ringLists = await Promise.all(KMS_LOCATIONS.map(async (loc) => {
    const r = await runGcloud(['kms', 'keyrings', 'list',
      `--location=${loc}`, `--project=${project}`, '--format=json']);
    return (r.ok && Array.isArray(r.data))
      ? r.data.map(ring => ({ loc, ringName: ring.name.split('/').pop() }))
      : [];
  }));
  const rings = ringLists.flat();
  // 2. List keys per ring in parallel (bounded).
  const keyLists = await Promise.all(rings.map(async ({ loc, ringName }) => {
    const r = await runGcloud(['kms', 'keys', 'list',
      `--keyring=${ringName}`, `--location=${loc}`,
      `--project=${project}`, '--format=json']);
    return (r.ok && Array.isArray(r.data))
      ? r.data.map(k => ({ ...k, _location: loc, _keyring: ringName }))
      : [];
  }));
  for (const list of keyLists) keys.push(...list);
  return { ok: true, count: keys.length, data: keys };
}

async function main() {
  const init = await send('initialize', {
    protocolVersion: '2024-11-05', capabilities: {},
    clientInfo: { name: 'lens-gcp-fetch', version: '1.0.0' },
  });
  console.log('MCP server:', JSON.stringify(init.result?.serverInfo));
  notify('notifications/initialized', {});

  // Decide which projects to scan
  let projects;
  if (SINGLE_PROJECT) {
    projects = [SINGLE_PROJECT];
    console.log(`Single project mode: ${SINGLE_PROJECT}`);
  } else {
    console.log('Discovering all visible projects...');
    projects = await listProjects();
    console.log(`Found ${projects.length} project(s): ${projects.join(', ') || '(none)'}`);
  }

  const result = { fetchedAt: new Date().toISOString(), projectCount: projects.length, projects: {} };

  // Concurrency: run up to N service fetches at once per project to cut wall time
  // (each gcloud call cold-starts the CLI, so serial is very slow).
  const CONCURRENCY = 6;

  for (const project of projects) {
    console.log(`\n=== PROJECT: ${project} (${FETCH_PLAN.length} services) ===`);
    const pres = { services: {} };
    const queue = [...FETCH_PLAN];
    async function worker() {
      while (queue.length) {
        const entry = queue.shift();
        if (!entry) break;
        try {
          const r = await fetchService(entry, project);
          pres.services[entry.key] = r;
          console.log(`  • ${entry.key}: ${r.ok ? 'OK (' + r.count + ')' : 'blocked/empty'}`);
        } catch (e) {
          pres.services[entry.key] = { ok: false, error: String(e) };
          console.log(`  • ${entry.key}: ERROR`);
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    // KMS needs per-location discovery; run it separately (serial, bounded).
    try {
      const kms = await fetchKms(project);
      pres.services['kms_crypto_keys'] = kms;
      console.log(`  • kms_crypto_keys: OK (${kms.count})`);
    } catch (e) {
      pres.services['kms_crypto_keys'] = { ok: false, error: String(e) };
      console.log('  • kms_crypto_keys: ERROR');
    }

    result.projects[project] = pres;
    // Write incrementally so a timeout still leaves partial data on disk.
    writeFileSync(OUT, JSON.stringify(result, null, 2));
    console.log(`  [saved progress after ${project}]`);
  }

  writeFileSync(OUT, JSON.stringify(result, null, 2));

  // Summary: per project, which services returned data
  console.log('\n================ SUMMARY ================');
  for (const [proj, pres] of Object.entries(result.projects)) {
    const withData = Object.entries(pres.services)
      .filter(([, v]) => v.ok && v.count > 0)
      .map(([k, v]) => `${k}=${v.count}`);
    console.log(`\n${proj}:`);
    console.log('  ' + (withData.length ? withData.join(', ') : '(no readable resources)'));
  }
  console.log(`\nFull data written to: ${OUT}`);

  srv.kill();
  process.exit(0);
}

setTimeout(() => { console.log('TIMEOUT'); srv.kill(); process.exit(1); }, 1800000);
main().catch(e => { console.error('FATAL', e); srv.kill(); process.exit(1); });
