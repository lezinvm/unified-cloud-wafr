# Unified Cloud WAFR Platform (L.E.N.S)
## Product Documentation & Technical Specifications

---

### Executive Overview

The **Unified Cloud WAFR Platform** (**L.E.N.S** - *Live Evaluation & Non-invasive Scanning*) is an automated cloud governance, posture evaluation, and remediation orchestration platform. It continuously evaluates multi-cloud environments across **AWS**, **Azure**, and **GCP**, maps visual dependencies, and delivers automated, syntax-validated Infrastructure-as-Code (IaC) fixes.

---

## 1. Core Features Catalog

### 1.1 Multi-Cloud Discovery & Scanning
- **Agentless Scanning**: 100% read-only discovery via control-plane APIs with zero software installed on target workloads.
- **Multi-Cloud Support**: Native discovery across Amazon Web Services (AWS), Microsoft Azure, and Google Cloud Platform (GCP).
- **270+ Automated Checks**: Deep evaluation across all 5 Well-Architected Framework pillars in under 90 seconds.
- **Live Scan Progress**: 4-stage real-time progress visualizer (Discovery, Checks, Topology, Scoring) with live pass/fail counts streamed via WebSockets.

### 1.2 Dual-Scope Questionnaire & Auditor Evidence
- **Organizational Scope**: Enterprise IT governance assessment covering root MFA, SCP guardrails, disaster recovery SLAs, and corporate FinOps tagging.
- **Workload Scope**: Runtime technical checks covering VPC routing, database replication, encryption, and public ingress.
- **Auditor Evidence Guidance**: Embedded guidance for each check: *Why It Matters*, *How to Verify* (CLI commands/console paths), *Evidence Requirements* (JSON outputs/screenshots), and interactive step checklists.

### 1.3 Keycloak-Based Authentication & Authorization
- **Keycloak 24 Integration**: OIDC authentication via [keycloakAuth.ts](file:///c:/Users/CLOPS_Lezin/Downloads/Unified%20Cloud%20WAFR%20Wireframes/src/services/keycloakAuth.ts).
- **Direct Access Grants**: In-app authentication without forced external redirects.
- **Authorization Code Flow**: Standard OAuth2/OIDC flow with PKCE for secure logins.
- **Google Social SSO**: One-click corporate Google identity provider login.
- **Self-Service Registration**: In-app user sign-up with automatic user provisioning.
- **Silent Token Refresh**: Automatic renewal of access tokens and refresh tokens.
- **RBAC Roles**: Granular roles: `Admin`, `Architect`, `Auditor`, and `Viewer`.

### 1.4 Automated AI Remediation
- **4 Synchronized Fix Formats**:
  1. *Terraform (`.tf`)*: Production-ready modules with input variables and outputs.
  2. *CloudFormation / Azure Bicep*: Native declarative templates.
  3. *CLI Commands*: Ready-to-run Bash and PowerShell commands.
  4. *Console Playbooks*: Step-by-step navigation instructions for web console execution.
- **Blast Radius Assessment**: Evaluates potential service disruption and expected downtime.
- **Effort Estimation**: Displays implementation difficulty and estimated time (e.g., "Low Effort · 15m").

### 1.5 IaC Easy Remediation & Resource-Level Tracking
- **Simulation Preview**: Dry-run preview validating code changes before application.
- **1-Click Code Actions**: Direct copy and file download for generated `.tf`, `.json`, and CLI scripts.
- **Granular Resource Tracking**: Track each affected ARN/Resource ID individually:
  - `fixed`: Marks resource resolved and triggers live verification check.
  - `cant_fix`: Opens a governance modal to record an audit justification note.
  - `pending`: Active issue awaiting remediation.
- **Real-Time Score Recalculation**: Posture and pillar scores recalculate dynamically as resources are resolved.

### 1.6 Infrastructure Repository Integration (GitOps)
- **Git Providers**: Direct connection to **GitHub**, **GitLab**, and **Bitbucket** via PAT or OAuth.
- **1-Click Pull Request Export**: Automatically generates a dedicated git branch, commits the validated Terraform module, writes the PR description with risk rationale, and returns the direct PR link.

### 1.7 DevOps & Ticketing Integrations
- **Jira Software**: Bi-directional integration creating prioritized Jira tickets with check details, severity, and affected ARNs.
- **Slack & Google Chat**: Formatted webhook alert cards triggered on scan completion or high-risk detections.
- **Alert Audit Logs**: Central chronological log tracking notification history and delivery statuses.

### 1.8 Interactive Visual Architecture Topology
- **Dynamic SVG DAG**: Visualizes VPC networking, subnets, IGW, ALB, WAF, EC2, Lambda, EKS, RDS, ElastiCache, and S3.
- **Pulsing Risk Badges**: Nodes with active architectural failures pulse with red/amber indicators.
- **Click-to-Remediate Drilldown**: Clicking any node opens an inspector drawer showing findings and direct links to the AI Fix playbook.

### 1.9 Assessment Lifecycle Management
- **Immediate Execution**: On-demand scans for selected accounts, regions, and lenses.
- **Assessment Status Updating**: Tracks state transitions: `draft` -> `queued` -> `running` -> `complete` / `failed`.
- **Idempotent Reruns**: "Re-run" button preserves configurations and updates existing assessments with an incremented rerun counter (`Rerun #2`, `Rerun #3`).
- **Assessment Deletion**: Safely delete assessments, findings, and associated data from MongoDB with confirmation guards.

### 1.10 Scheduled Assessments
- **Automated Cron Scheduling**: Configure automated recurring reviews (Daily, Weekly, Bi-Weekly, Monthly).
- **Target Filtering**: Bind schedules to specific accounts, regions, and lenses.
- **Management Controls**: Enable/disable active status toggle and "Run Now" instant execution.

### 1.11 Milestone Engine & Historical Drift Tracking
- **Immutable Baselines**: Record versioned milestone snapshots (`v1.0`, `v1.1`, `v2.0`).
- **Score Velocity & Waterfall Charts**: Visualizes risk burndown (HRIs and MRIs resolved).
- **Drift Comparison**: Compares current posture against baselines over 30, 60, 90, or 365-day intervals to catch regressions.

### 1.12 Multi-Tenant Administration & AI Quota Control
- **Tenant Isolation**: Clean separation of organizations, cloud accounts, and assessments.
- **User Management**: Team member invitations and role management.
- **AI Token Quota Governance**: Real-time token consumption tracking and monthly dollar budget caps.

### 1.13 Conversational AI Copilot (Chatbot)
- **In-App Copilot**: Context-aware chatbot answering queries based on active assessment findings.
- **Actionable Navigation**: Quick-action buttons to jump directly to specific report views and pillars.

### 1.14 Data Sovereignty & Automated Purging
- **Configurable Retention**: Retention schedules configurable from 7 to 365 days.
- **Daily Automated Purge**: Daemon executes daily at 02:00 UTC to permanently shred expired snapshots.

---

## 2. Technical Specifications & Frameworks

### 2.1 Multi-Cloud Ingress & Identity Protocols
- **AWS**: Ephemeral STS `AssumeRole` with unique `ExternalId`. Scoped to `SecurityAudit` and `ReadOnlyAccess`.
- **Azure**: Entra ID Service Principal with `Reader` RBAC role.
- **GCP**: IAM Service Account with `Viewer` permissions.

### 2.2 Supported Frameworks & Lenses
- **Well-Architected Framework**: 5 Core Pillars (Reliability, Security, Cost Optimization, Operational Excellence, Performance Efficiency).
- **Compliance Cross-Walks**: CIS Benchmarks (L1 & L2), SOC 2 Type II, ISO 27001:2022, HIPAA, PCI-DSS v4.0.
- **Specialized Lenses**:
  - *Core WAFR Lens*: 5 foundational pillars.
  - *GenAI Lens*: LLM prompt injection defenses, vector DB latency, token economics, and guardrails.
  - *FinOps Lens*: Unit economics, waste detection, commitment arbitrage, and tag coverage.

---

## 3. Functional (FR) & Non-Functional (NFR) Requirements

### 3.1 Functional Requirements
- **FR-1 Discovery**: Agentless scan of AWS/Azure/GCP metadata in < 90 seconds.
- **FR-2 Dual Scope**: Evaluate organizational governance questionnaire alongside runtime technical checks.
- **FR-3 Multi-Lens**: Support Core WAFR, GenAI, and FinOps lenses.
- **FR-4 Live Telemetry**: WebSocket stream of 4 scan stages with live pass/fail counters.
- **FR-5 Topology**: Render interactive SVG DAG with pulsing risk nodes and finding inspector.
- **FR-6 AI Remediation**: Generate Terraform, CloudFormation, CLI, and console guides with blast radius.
- **FR-7 Resource Tracking**: Support `fixed`, `cant_fix`, and `pending` toggles with real-time score updates.
- **FR-8 GitOps Export**: 1-click PR creation into GitHub, GitLab, and Bitbucket.
- **FR-9 Integrations**: Jira issue creation, Slack/Google Chat webhook alerts, and alert logs.
- **FR-10 Lifecycle**: Assessment creation, scheduling, status updating, idempotent reruns, and deletion.
- **FR-11 Milestones**: Lock immutable baselines (v1.0) and track drift across 30-365 days.
- **FR-12 Auth & Admin**: Keycloak OIDC, Direct Access Grants, Google SSO, RBAC, and AI token quotas.

### 3.2 Non-Functional Requirements
- **NFR-1 Security & Encryption**: TLS 1.3 in transit, AES-256 KMS CMK at rest. Zero storage of customer application data.
- **NFR-2 Zero-Write IAM**: Scanners strictly restricted to read-only APIs (`Get*`, `List*`, `Describe*`).
- **NFR-3 Performance**: UI load < 1.5s, API response < 200ms, scan execution < 90s, AI code generation < 8s.
- **NFR-4 Availability**: 99.9% uptime SLA with stateless workers and autoscaling.
- **NFR-5 Scalability**: Concurrent execution of 100+ cloud account scans.
- **NFR-6 Data Retention**: Configurable retention (7-365 days) with automated 02:00 UTC daily purge.
- **NFR-7 Portability**: Deployable as SaaS, Dedicated Customer VPC, or Air-Gapped On-Premises Kubernetes.
- **NFR-8 Observability**: OpenTelemetry metrics, traces, and structured JSON logs to Tempo/Loki/Grafana.

---

## 4. AI-Driven vs. Non-AI (Deterministic) Components

The platform enforces a strict boundary: **deterministic engines handle checks and scoring**, while **AI models handle explanation, code synthesis, and chat**.

| Platform Function | Component Type | Implementation |
| :--- | :--- | :--- |
| **Resource Enumeration** | Deterministic | Provider SDK control-plane API queries. |
| **Rule Assertions** | Deterministic | 270+ rule evaluations using AST & boolean logic. |
| **Score Calculations** | Deterministic | Mathematical formula: `(Passed / Total) * 100` weighted by severity. |
| **Topology DAG Mapping** | Deterministic | Graph construction from VPC CIDRs, Route Tables, and Target Groups. |
| **Milestone Drift Diffing** | Deterministic | Set difference: `Current_Failed ⊖ Baseline_Failed`. |
| **Remediation Code Generation**| AI-Driven (LLM) | Foundation models (Claude 3.5 / GPT-4o) generating tailored IaC. |
| **IaC Code Verification** | Deterministic | Ephemeral container running `terraform validate`, `tflint`, and `checkov`. |
| **Copilot Chatbot** | AI-Driven (LLM) | Contextual RAG over findings and framework documentation. |

### AI Guardrails Validation Pipeline
All generated IaC passes through a 3-gate automated pipeline before display:
1. **Gate 1: Syntax & AST**: HCL parsing and `terraform validate`. Failed parses trigger a self-correction loop (max 3 retries).
2. **Gate 2: Static Security Linting**: Ephemeral scan via `tflint` and `checkov`.
3. **Gate 3: RAG Grounding**: Hallucination check ensuring faithfulness score > 0.95.

---

## 5. Orchestration & State Tracking

### 5.1 Orchestrator Agent (Asynchronous Brain)
- **Lifecycle**: `Wake -> Decide -> Act -> Exit`.
- Wakes upon event (user scan or schedule), analyzes state in MongoDB, posts sub-jobs, and exits to free compute resources.

### 5.2 State Tracking Engine
- **MongoDB**: Primary transactional store for assessments, findings, schedules, milestones, and integration configs.
- **Watcher Service**: Background daemon polling MongoDB and monitoring agent heartbeats to wake the Orchestrator when jobs finish.
- **Temporal.io**: Durable workflow orchestrator ensuring multi-region scans survive failures and resume without re-running completed queries.

---

## 6. Microservices & Platform Services

- **`lens-gateway` (FastAPI)**: API gateway, auth validation, and WebSocket streaming.
- **`lens-discovery` (Go / Python)**: Multi-cloud metadata collector.
- **`lens-evaluator` (Go / Python)**: Deterministic 270+ rule engine.
- **`lens-topology` (Node.js / Python)**: SVG DAG topology generator.
- **`lens-ai-remediator` (LangGraph)**: LLM orchestration for IaC synthesis.
- **`lens-milestones` (Python)**: Baseline snapshot and drift comparison service.
- **`lens-scheduler` (Celery Beat)**: Cron scheduler for recurring scans and purges.
- **`lens-rerun` (Python)**: Idempotent rerun handler.
- **`lens-dispatcher` (Python)**: Adapters for GitHub, GitLab, Jira, Slack, and Google Chat.
- **`lens-admin` (Python)**: Tenant management and AI token quota tracking.

---

## 7. Frontend & API Layer

- **Frontend**: React 19, TypeScript 5.7+, Tailwind CSS v4, dynamic Light/Dark themes.
- **API Gateway**: FastAPI async REST endpoints and WebSocket channels with Pydantic v2 validation.
- **Redis 7 Caching**: Fast cache for frequent polling and WebSocket pub/sub message broker.
- **Keycloak Auth**: Direct in-app authentication, silent token refresh, and RBAC enforcement.

---

## 8. Agent System

Distributed mesh of specialist worker agents communicating via a standardized Job API:
1. **Orchestrator Agent**: Workflow planner and task dispatcher.
2. **Graph Builder Agent**: Maps cloud resources into a topology graph.
3. **Config Check Agent**: Audits individual resource configurations.
4. **Relational Check Agent**: Audits cross-resource security and networking.
5. **Reports & Findings Agent**: Aggregates findings and calculates pillar scores.
6. **Remediation & Tracker Agent**: Synthesizes IaC and tracks approval/solved status.
7. **Chatbot Copilot Agent**: Conversational assistant with contextual RAG.

---

## 9. Cloud Integration & Security Architecture

- **Cloud MCP Servers**: AWS, Azure, and GCP Model Context Protocol servers act as sandboxes, exposing only safe, read-only tools to agents without credential exposure.
- **Least-Privilege Access**: Enforced read-only roles with ephemeral session tokens.
- **Rate-Limiting & Jitter**: Cloud MCP servers absorb API rate limits with exponential backoff.
- **Data Protection**: TLS 1.3 in transit, AES-256 KMS CMK at rest, zero customer application data access.
