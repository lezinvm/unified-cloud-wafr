# Unified Cloud WAFR - Comprehensive Project Documentation

![Architecture Diagram](./architecture_diagram.png)

## 1. Product Requirements Document (PRD)

### 1.1. Executive Summary
**Unified Cloud WAFR (Well-Architected Framework Review)** is an automated platform designed to evaluate, report on, and remediate cloud infrastructure configurations across major cloud providers (AWS, Azure, GCP). By blending deterministic microservices with intelligent AI agents, it continuously monitors cloud environments, checks configurations against best practices, generates detailed findings, and proposes automated remediations, providing users with interactive control via a Web UI and Chatbot.

### 1.2. Functional Requirements
*   **Multi-Cloud Review Initiation:** Users must be able to start, schedule, and track cloud infrastructure reviews for AWS, Azure, and GCP via a Web UI.
*   **Automated Data Gathering:** The system must connect to cloud providers to dynamically fetch resource configurations and topological (relational) data.
*   **Intelligent Analysis:** The system must evaluate individual configurations and complex resource relationships against Well-Architected best practices.
*   **Reporting & Findings:** The platform must aggregate analysis results into structured, human-readable reports highlighting risks, violations, and compliance scores.
*   **Automated Remediation:** The system must generate and propose code or configuration changes to fix identified issues, requiring human (or Orchestrator) approval before applying them.
*   **Conversational Interface:** A Chatbot must allow users to query review status, ask questions about findings, and request actions using natural language.
*   **Integrations:** The system must integrate with external tools (e.g., Jira for ticketing, Git for IaC).
*   **Authentication & Authorization:** Secure user login and role management via an identity provider (Keycloak).

### 1.3. Non-Functional Requirements
*   **Scalability:** An event-driven, microservices architecture must allow independent scaling of the API layer, Orchestrator, and Specialist Agents to handle large cloud environments.
*   **Reliability & Resilience:** Long-running reviews must survive component failures. A Watcher service and state-tracking database (MongoDB) ensure jobs can be retried or resumed.
*   **Performance:** High-frequency API calls must be optimized using caching layers (Redis).
*   **Observability:** The system must emit metrics, logs, and distributed traces (via OpenTelemetry) to a central observability stack (Tempo, Loki, Grafana) for rapid debugging.
*   **Security:** Cloud interactions must be heavily guarded using dedicated Model Context Protocol (MCP) servers to ensure agents operate with least-privilege access.

---

## 2. High-Level Solution & Approach

The solution relies on an event-driven architecture that effectively delegates tasks between deterministic software components and non-deterministic AI models. 

### 2.1. What is done via AI vs. Non-AI?

To maintain reliability, hallucination risks are minimized by keeping data gathering and state management deterministic, reserving AI strictly for decision-making, natural language processing, and complex heuristic analysis.

**AI-Driven Components (LLMs & Guardrails):**
*   **Orchestrator Agent:** Uses LLMs to plan the workflow (`wake -> decide -> act -> exit`), interpreting triggers and deciding which specialist agents to invoke.
*   **Config & Relational Check Agents:** Employs AI to interpret complex cloud configurations against abstract Well-Architected Framework principles that are hard to codify deterministically.
*   **Remediation Agent:** Generates IaC (Infrastructure as Code) or CLI commands to fix identified issues based on the context of the finding.
*   **Chatbot:** Processes natural language queries from users and translates them into system commands or informational summaries.

**Non-AI (Deterministic) Components:**
*   **Graph Builder Agent:** Deterministically queries Cloud APIs (via MCP) and maps the JSON responses into a structured Graph DB topology.
*   **Watcher Service:** A traditional background daemon that polls MongoDB for job statuses, monitors agent heartbeats, and manages state transitions.
*   **API Layer & Auth:** Standard REST/GraphQL APIs and Keycloak IAM.
*   **Platform Services:** Traditional microservices handling scheduling, milestones, git integrations, and rerun logic.
*   **Cloud MCP Servers:** Strict, deterministic proxy servers that expose specific, safe cloud API methods to the agents.

### 2.2. Orchestration & State Tracking
*   **Orchestration:** Unlike synchronous API chains, the **Orchestrator Agent** acts as an asynchronous brain. It wakes up upon an event (e.g., user request, job completion), analyzes the current state, submits new sub-jobs to the database, and then goes to sleep (`exit`), freeing up compute resources.
*   **State Tracking:** **MongoDB** acts as the ultimate source of truth for the system's state. It stores Runs, Jobs, and Findings. The **Watcher** service continuously polls this database and agent heartbeats, acting as the heartbeat monitor. If a job is approved or a state changes, the Watcher wakes the Orchestrator to make the next decision.

### 2.3. Microservices & Platform Services
The supporting platform is decentralized. Specific microservices handle isolated domains:
*   **Scheduler:** Cron-based triggers for recurring assessments.
*   **Milestone:** Emits events when a review reaches key completion percentages.
*   **Rerun Service:** Idempotency handler allowing users to re-trigger failed checks without starting from scratch.
*   **Third-Party / Git Connectors:** Adapters for external SaaS platforms.

---

## 3. System Architecture & Components

### 3.1. Frontend & API Layer
*   **Web UI:** The user-facing portal built with React, Vite, and Tailwind CSS.
*   **API Layer:** The central gateway. Uses **Redis** caching to serve frequent UI requests (like status polling) without hitting the database.
*   **Keycloak:** Manages enterprise authentication and issues tokens to the API layer.

### 3.2. Agent System
*   **Specialist Agents Pool:** Worker agents that communicate status via a heartbeat Job API.
    *   **Graph Builder:** Maps infrastructure into a Graph Database.
    *   **Config Check:** Analyzes individual resource settings.
    *   **Relational Check:** Analyzes security/architecture across connected resources (e.g., VM -> Security Group -> Subnet).
    *   **Reports & Findings:** Aggregates data into final reports.
    *   **Remediation & Tracker:** Creates fixes (execution requires explicit approval).

### 3.3. Cloud Integration
*   **Cloud MCP Servers (AWS, Azure, GCP):** Secure sandboxes that expose standardized cloud operations to the agents, preventing direct credential handling by the LLMs.

---

## 4. Data Stores

*   **Redis:** High-speed cache for the API layer.
*   **MongoDB:** Document store for transactional state (Runs, Jobs, Findings).
*   **Graph DB:** Relationship store designed specifically for querying cloud topology (e.g., finding all exposed databases connected to a specific gateway).
*   **Trace & Log Store (Tempo / Loki / Grafana):** Ingests telemetry via an **OTEL Collector** from all agents and services for deep observability.

---

## 5. End-to-End System Workflow

1.  **Initiation:** User requests a new WAFR run via the Web UI.
2.  **API & Auth:** Request is authenticated by Keycloak and routed through the API Layer.
3.  **Wake Orchestrator:** The API Layer writes a "Start Run" event to MongoDB and wakes the Orchestrator Agent.
4.  **Plan & Delegate:** The Orchestrator decides the required checks, creates Jobs in MongoDB, and exits.
5.  **Execution Trigger:** The Watcher polls MongoDB, sees new jobs, and wakes the necessary Specialist Agents (e.g., Graph Builder).
6.  **Data Gathering:** Agents query the cloud via MCP Servers and store topology in the Graph DB.
7.  **Analysis:** As data becomes available, the Watcher wakes Config and Relational Check agents to analyze it.
8.  **Findings Generation:** Violations are saved to MongoDB. The Orchestrator wakes the Reports & Findings agent to compile them.
9.  **Remediation:** If enabled, the Remediation agent drafts fixes. The Watcher halts execution until user/Orchestrator approval is received.
10. **Completion & Observability:** Throughout the run, heartbeats and logs flow to the OTEL collector. The Web UI and Chatbot read from the API Layer/Redis to show real-time progress.
