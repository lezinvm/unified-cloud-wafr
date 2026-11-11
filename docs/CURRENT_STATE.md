# L.E.N.S: current state (read this first)

**As of:** 2026-11-11 · **Working branch:** `dev-lezin` (latest work) · **`main`:** `7047ffc` (behind; prod runs older `4c6f7f6`)

This file is the authoritative status. Anything in `handoff/master/` dated before
this file is **superseded** where it disagrees (see "Corrections to older docs").
Update this file whenever you change architecture, environments or rules.

---

## 1. Rules for any AI agent or engineer working here

1. **Work on `dev-lezin`, never commit to `main`.** Merging to `main` needs the owner's explicit OK.
2. **Never touch prod without explicit approval:** `~/wafr-app`, compose project `wafr-app`, host nginx port 80 site, the Keycloak realm `lens-realm`.
3. **Real data only in dev.** No fake fallbacks, invented numbers, `setTimeout` "success", or demo labels in real-only builds. If a feature can't be real yet, gate it (`REAL_DATA_ONLY` / `RealDataNotice`) instead of faking it.
4. **Nothing cloud-specific outside the provider registries.** Scan/load specifics go in `backend/scan_providers.py`; check logic goes in `backend/checks/<cloud>_checks.py`. The engine, loader and scan runner stay generic (`--provider`).
5. **Every API route needs a policy** in `backend/tenancy.py` `POLICIES` (a test fails otherwise). Identity, org and role come only from the verified token.
6. **Results are per assessment.** Anything a scan writes carries `assessment_id`; never write tenant results into shared/global documents.
7. **Never commit secrets or scan output:** `.env`, `deploy/**/*.env`, service-account keys, `backend/mcp_fetch/*.json`, `assessment_result*.json`, `handoff/`.
8. **Verify before claiming done:** backend tests pass, `pnpm build` passes, `tsc --noEmit` shows 0 errors.
9. **Never assume one project/account.** No hardcoded scope ids or fallbacks; per-scope files only (§3).

---

## 2. Environments (one GCP VM, isolated stacks)

VM `lens-multicloud`, project `lens-wafr-gcp`, zone `us-central1-a`, Debian 13, 2 vCPU / 3.8 GB RAM, 25 GB disk, static IP `35.232.48.159` (`wafr-static-ip`). VM identity: service account `lens-scanner@lens-wafr-gcp.iam.gserviceaccount.com` (roles: viewer, iam.securityReviewer, logging.logWriter, monitoring.metricWriter), scope cloud-platform.

| | **Prod** | **Dev** |
|---|---|---|
| Code | `~/wafr-app`, `main` @ `4c6f7f6` | `~/wafr-dev`, `dev-lezin` |
| Run | compose project `wafr-app` (backend, mongo, keycloak, mongo-express) | compose project `lens-dev` (`deploy/dev/docker-compose.yml`: backend, mongo) |
| Web | host nginx **:80** → `~/wafr-app/dist` | host nginx **:8444** → `~/wafr-dev/dist` (`/etc/nginx/conf.d/lens-dev.conf`) |
| API | :8000 (public) | `127.0.0.1:8001` only; reached via `:8444/api` |
| DB | volume `wafr-app_mongo_data` | volume `wafr_dev_mongo` (no published port) |
| Auth | legacy, browser-side; **API unauthenticated** | Keycloak realm `lens-dev`, client `lens-dev-app`; API requires a token |
| Data | demo/seed data | real scans only |

Shared: host nginx (separate server blocks) and the Keycloak container `wafr-keycloak` (:8080, `start-dev`, separate realms).

**Dev commands** (on the VM, in `~/wafr-dev`):

```bash
git pull origin dev-lezin && scripts/dev-env.sh rebuild   # update + restart dev
scripts/dev-env.sh status | logs | down
scripts/dev-env.sh scan <assessment-id>                    # rescan, same pipeline as the UI "Scan now"
scripts/dev-env.sh scan-account <id> <dev|pre-prod|prod> [regions]   # new assessment for an account + scan
scripts/dev-env.sh reset-data                              # wipe demo data, reload every stored project/account
scripts/keycloak-dev-realm.sh <email> <org_id> [admin]     # create/refresh dev realm + user
```

Firewall rule `wafr-dev-access` allows :8444/:8001 from the owner's IP only.

---

## 3. Scan pipeline (real, working for GCP)

```
verify provider verify_cmd                     quick access check (GCP: gcloud projects describe)
fetch  backend/mcp_fetch/gcp_fetch_all.mjs   official gcloud MCP server 0.5.3, read-only, VM identity
check  backend/check_engine.py --provider p   126 catalog controls → PASS/FAIL/UNKNOWN/NOT_APPLICABLE
load   backend/load_assessment_to_db.py       assessment, findings, remediations, checks, best practices,
                                              inventory, milestone, all keyed by assessment_id
```

**Multi-cloud, multi-account.** Nothing is tied to one project. Any number of GCP projects / AWS
accounts / Azure subscriptions, in any number of orgs:

- **One account, many assessments.** An assessment = cloud account + `environment`
  (`dev` | `pre-prod` | `prod`, the "Account type / environment" choice) + `regions` (`[]` = all).
  `POST /api/scans` takes `{assessment_id}` (rescan, keeps its name/environment/regions) **or**
  `{cloud_account_id, environment, regions?, name?}` (always creates a **new** assessment
  `A-<PROVIDER>-<scope>-<6hex>` owned by the account's org, then scans it). CLI:
  `scan_runner.py --assessment-id` / `--cloud-account-id --environment [--regions]`. Needs `SCAN_ENABLED=1`.
- **No duplicates (per org):** a new assessment with the same account + environment + region set as an
  existing one **of the same org** is refused (409, message names the id to rerun). Older assessments
  without `environment` count as prod; region label `global`/`All regions` = all regions
  (`scan_runner.find_duplicate`, `stored_regions`). Another org on the same project is independent
  and is never revealed.
- **UI:** the 3-step `Wizard` (Antigravity `29312cf`) is used in all builds; in real-only builds it
  lists the user's real accounts, warns about duplicates and offers "Rerun Assessment", and starts
  `startAccountScan` with one region. `src/screens/NewAssessmentReal.tsx` (account + environment +
  all/many regions) exists but is no longer routed. Settings > account > "New assessment" opens the wizard.
- **Regions.** The fetch always covers the whole scope (stored once per scope). Each scan checks a
  copy filtered to the assessment's regions (`ScanProvider.filter_regions`). Items with no region
  (IAM policy, service accounts, org policies, VPC networks, firewall rules, routes, global
  addresses, secrets...) are **account-wide and included in every assessment**. Multi-region
  locations (`US`, `EU`, `nam5`) match the regions in that geography. Region of an item:
  `ScanProvider.item_region` (GCP: region/zone/location fields, `/locations|regions|zones/` in the
  name, Cloud Run location label). `GET /api/cloud-accounts/{id}/access` returns resources per
  region from the last fetch for the form.
- Scope id comes from the stored account via the provider's `scope_of` (GCP `gcp_project`; AWS 12-digit
  `account_identifier` or the account in `role_arn`; Azure `subscription_id`), never from the request.
- Results attach to the user's own cloud account (`--cloud-account-id` on the loader); the loader no
  longer creates a project-named account for UI scans.
- Files: one fetch per scope `DATA_DIR/<provider>/<scope>.json`; per-scan temp/result files in
  `RUN_DIR`. Old `<provider>_fetch_result.json` is split per scope at backend startup / `reset-data`.
- **Queue:** scans run one at a time in order; others wait as `queued` (not refused). Only a second scan
  of the same assessment is refused. Queued scans survive a restart; running ones are marked interrupted.
- **Access check first:** if the scanner can't read the scope, the scan fails in seconds with
  `access_hint` (the exact `gcloud projects add-iam-policy-binding … roles/viewer` +
  `roles/iam.securityReviewer` command for the scanner SA). `GET /api/cloud-accounts/{id}/access`
  returns scope + hint for the UI.
- **To add a new GCP project:** grant `lens-scanner@lens-wafr-gcp.iam.gserviceaccount.com`
  `roles/viewer` and `roles/iam.securityReviewer` on it, add the account in Settings with its project
  id, press "New assessment", pick environment + regions.
- **Fetch memory:** every gcloud call is a ~100 MB process; the fetcher caps calls in flight
  (`GCP_FETCH_CONCURRENCY`, default 4, dev 3). Dev backend `mem_limit: 1g`.
- Targeted re-checks (`/api/checks/rerun`) fetch into a temp file and never replace the stored full fetch.
- A fetch with fewer than 20 readable services is rejected and previous data kept.
- Last real result for `A-GCP-lens-wafr-gcp`: 42 services readable, score 20, 33 fail / 8 pass, 42 unknown, 43 n/a, 137 resources.
- Control catalog: `backend/seed_data/control_catalog.csv` (126 controls; columns for gcp/aws/azure checks and CIS/SOC2/ISO/HIPAA mappings).
- Fix guidance for failing controls: `backend/remediation_guidance.py` (**authored**, not scan data; tagged `guidance_source: "authored"`).

**Adding AWS or Azure:** fill the `AWS`/`AZURE` entries in `backend/scan_providers.py` (fetcher command via the official MCP server, inventory types, resource/location mapping, guidance) and write checks in `backend/checks/aws_checks.py` / `azure_checks.py`. Nothing else changes. Both are registered now without fetchers, so their scans are refused cleanly. Needs: AWS read-only IAM role (external ID) / Azure service principal with Reader.

---

## 4. Auth and tenant isolation

- **Backend** (`AUTH_MODE=keycloak`): `backend/auth.py` verifies RS256 tokens (JWKS, issuer, expiry, `azp` = client, required `org_id` claim; admin = realm role `lens-admin`). `backend/tenancy.py` middleware: fail-closed policy table for all routes, overwrites `org_id`/`user_id` in query and body from the token, ownership checks on every referenced id, disabled fake routes (GET returns `[]`). Docs closed and CORS restricted (`CORS_ORIGINS`) when auth is on.
- **Frontend** (`VITE_AUTH_MODE=oidc`): `src/services/oidc.ts`, authorization code + PKCE (pure-JS SHA-256 because dev is plain http). Tokens in memory/sessionStorage; the profile is rewritten from the token before the app mounts (`src/main.tsx`), so localStorage can't forge identity.
- Legacy mode (no `AUTH_MODE`) is what prod still runs: no API auth.

## 5. Real-data-only mode

- Frontend `VITE_REAL_DATA_ONLY=true` (`src/config/realData.ts`): removes demo fallbacks; gates simulated features with `RealDataNotice` (wizard, schedules, architecture diagram, compliance, chat, Jira/Slack/PR, rerun/verify, fake connection tests). "Scan now" / rerun buttons start the **real** scan (`LiveScanReal` screen).
- Backend `REAL_DATA_ONLY=1`: fabricating endpoints refuse (409).

## 5b. Compliance (CIS, SOC 2, ISO 27001:2022, HIPAA)

- `backend/compliance.py` scores each assessment from **real control verdicts**, written by the loader
  on every scan into `assessment_compliance_scores` (one doc per framework, `CS-<assessment>-<fw>`),
  plus `assessments.compliance_summary`. API: `GET /api/compliance-scores?assessment_id=` (tenant-scoped).
- Hierarchy: framework → requirement (e.g. `CC6.1`) → catalog controls → per-cloud checks. Mappings
  come from `control_catalog.csv`; one control serves several frameworks and runs once.
- Requirement status: **fail** if any mapped control fails; **pass** only if none fail and none are
  undecided; **not_assessed** if any control is UNKNOWN/NOT_IMPLEMENTED (never counted as passed);
  **not_applicable** if all are N/A. Score = pass/(pass+fail); shown with coverage and controls-passing %.
- CIS uses the cloud's column (`cis_gcp`/`cis_aws`/`cis_azure`). **CIS section numbers in the catalog are
  not validated** against the benchmark text (several look wrong); the UI shows this note.
- ISO: the catalog mixes 2013 ids (`A.9.x`, `A.6.1.3`, `A.8.1`); they are converted to 2022 ids
  (`ISO_2013_TO_2022`) and marked as converted. The catalog file itself is unchanged.
- Not covered: policy/procedure/training requirements (need manual attestation; parked).
- UI: `src/screens/ComplianceReal.tsx` (real-data-only build), framework cards and requirement list,
  failing controls link to their remediation.
- Last result for `lens-wafr-gcp`: CIS GCP 15% (coverage 52%), SOC 2 0% (71%), ISO 0% (61%), HIPAA 0% (65%).

## 6. Data model notes

- Assessment id for scans: `A-<PROVIDER>-<scope>-<6hex>` (older ones `A-<PROVIDER>-<scope>`); fields `environment`, `regions`, `region` (display label); finding `FND-<assessment>-<control>`; remediation `REM-<assessment>-<control>`; check `id` = control id (UI links by it) + `assessment_id`.
- `/api/pillars` returns one assessment's tree and scores (`assessment_id`, or the caller's latest for that cloud).

## 7. Open work (priority order)

1. TLS (needs a domain) · request validation (Pydantic) · prod hardening (:8000/:8081/docs public, root Dockerfile with `--reload`, Keycloak `start-dev` on H2). **On hold by owner.**
2. UI holds one account per cloud (`configuredAccounts` in context.tsx); scanning works for every
   account (Settings > Scan), but Dashboard/Onboarding still pick one per cloud. Refactor to a list.
   Fetcher: Redis is fetched only in `us-central1` (fixed region in `gcp_fetch_all.mjs`).
3. AWS, then Azure (fetchers, credentials, checks).
4. Real scheduled scans; scan history per run.
5. Replace or remove remaining fake features (integrations, PDF export, admin token usage, AI fix/chat).
5b. Compliance: validate CIS numbering against the benchmarks; manual attestation for policy controls.
6. Cut GCP UNKNOWNs (42) with deeper fetches.
7. Optional: simplify dev to plain `docker compose up -d --build` with a `web` container (proposed, not done).

## 8. Verification

```bash
cd backend && python -m pytest tests -q          # 94 tests; needs a reachable MongoDB
pnpm build                                       # frontend
pnpm exec tsc --noEmit -p .                      # 0 errors
```

## 9. Corrections to older docs (`handoff/master/*`, 2026-10-16)

| Older docs say | Actually |
|---|---|
| Login uses Direct Access Grants (password in app) | Dev uses OIDC code + PKCE; the old in-app login fell back to "email exists in DB = logged in" and is not used in dev |
| Hardcoded mock fallbacks eliminated | Only true in the real-data-only build; prod/default build still contains them |
| Live MCP scanning pending | Working for GCP (UI + CLI) |
| VM Ubuntu 22.04, `asia-south1-a` | Debian 13, `us-central1-a` |
| 19 screens fully functional | Several screens simulate results; see §5 and §7 |
