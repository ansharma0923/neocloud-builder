# Security Policy

## Reporting a Vulnerability

**Please do NOT file a public GitHub issue for security vulnerabilities.**

Use [GitHub's private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability) to report vulnerabilities privately to the maintainers.

### What to include

- Description of the vulnerability and its potential impact
- Steps to reproduce the issue
- Affected versions or components
- Any suggested mitigations

### Response SLA

- **Acknowledgement:** within 3 business days
- **Initial assessment:** within 7 business days
- **Fix timeline:** depends on severity — critical issues targeted within 14 days

### Scope

In scope:
- Authentication and session management
- API authorization and access control
- File upload handling and storage
- AI prompt injection or data exfiltration
- Dependency vulnerabilities in `package.json`

Out of scope:
- Social engineering attacks
- Attacks requiring physical access
- Issues in third-party services (OpenAI, etc.)

### What NOT to do

- Do not disclose the vulnerability publicly before it has been patched
- Do not attempt to exploit the vulnerability beyond confirming it exists
- Do not access or modify data belonging to other users
