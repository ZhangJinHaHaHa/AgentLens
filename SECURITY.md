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

Instead, please send an email to the project maintainers or open a private security advisory on GitHub if enabled.

## Public Repository Hygiene

This public repository is limited to the public product surface: frontend code, public catalog data, public documentation, public-facing contract sources, and non-sensitive audit infrastructure.

Do not commit any of the following to this repository:

- Environment files, API keys, access tokens, private keys, passwords, or credential dumps.
- Production server IPs, SSH details, deployment scripts, runtime state, logs, backups, or operational records.
- Private control-plane code, internal worker services, runtime credentials, review consoles, or non-public platform implementation details.
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
