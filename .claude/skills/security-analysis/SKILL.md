---
description: Reviews changed code for common application-security vulnerabilities and unsafe trust boundaries
---

# Security Analysis

Apply this skill to all code under review. Base findings on evidence, not hypothetical technology choices.

## Trust boundaries

- Trace user, network, file, environment, and database input to sensitive sinks.
- Require validation, normalization, authorization, and safe error handling at boundaries.
- Flag hard-coded credentials and accidental secret or personal-data logging as critical.

## High-risk patterns

- Injection into shell, SQL, templates, paths, URLs, or dynamic code execution.
- Missing object-level authorization, privilege escalation, insecure defaults, or fail-open behavior.
- XSS through unsafe HTML, SSRF through unrestricted URLs, and path traversal through unchecked paths.
- Weak cryptography, insecure randomness, exposed tokens, and sensitive details in errors.
- Unbounded resource use, missing timeouts, or attacker-controlled expensive operations.

## Severity

- critical: directly exploitable with severe confidentiality, integrity, or availability impact.
- high: exploitable under realistic conditions with material impact.
- medium: defense-in-depth weakness or constrained exploit.
- low/info: limited risk or hardening advice.

## Output

Identify the source, sink, exploit precondition, impact, and smallest actionable remediation. Do not report generic OWASP checklist items without a code path.
