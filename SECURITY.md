# Security Policy

## Supported Versions

Currently, only the latest release of AgentLens is supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| v1.0.x  | :white_check_mark: |
| < v1.0  | :x:                |

## Reporting a Vulnerability

We take the security of AgentLens very seriously. If you discover a vulnerability, we would like to know about it so we can take steps to address it as quickly as possible.

Please **DO NOT** report security vulnerabilities via public GitHub issues.

Instead, use GitHub's private vulnerability reporting flow for this repository. Do not include exploit details in a public issue. If private reporting is temporarily unavailable, open only a minimal public issue asking the maintainers to enable a private reporting channel, without disclosing vulnerability details.

## Public Repository Hygiene

This public repository is limited to the public product surface: frontend code, public catalog data, public documentation, public-facing contract sources, machine-readable integration contracts, and non-sensitive audit infrastructure.

Public protocol schemas may describe Brain inputs and receipts, R0-R4 runtime planes, capability calls, quality records, and pricing snapshots. Those schemas are interoperability boundaries; they do not make the hosted orchestration, production routing, Workers, policy engines, scoring systems, or settlement ledgers public.

Do not commit any of the following to this repository:

- Environment files, API keys, access tokens, private keys, passwords, or credential dumps.
- Production server IPs, SSH details, production topology or deployment scripts, runtime state, logs, backups, or operational records. Generic local development and test deployment scripts may be public when they contain no production values.
- Brain prompts and routing algorithms, Provider weights or fallback order, capability-broker policy and allowlists, private quality scoring, billing or settlement internals, production Workers, runtime credentials, review consoles, or other non-public platform implementation details.
- Non-public research notes, incident artifacts, or customer/student data.

Before pushing public changes, run a secret scan against the worktree and confirm that any private implementation remains in the private repository only.

### What to include in your report

Please provide as much information as possible, including:
- The type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit the issue

### What to expect

1. We will acknowledge receipt of your report within 48 hours.
2. We will investigate the issue and determine its impact.
3. We will work with you to develop a fix.
4. We will publish a security advisory and release a patch.

Thank you for helping to keep AgentLens and our users safe!
