# Security

This plugin runs inside your Obsidian vault, so its security posture is deliberately strict. This page lists every measure in place and where to see its live results; the [project docs](https://tsvsheet.github.io/docs.tsvsheet.obsidian/) mirror this page.

## Reporting a vulnerability

Report privately via [GitHub private vulnerability reporting](https://github.com/tsvsheet/tsvsheet.obsidian/security/advisories/new) — never in a public issue. Reports are acknowledged within a week and disclosed after a fix ships.

## Design constraints

- **Zero third-party runtime dependencies.** The shipped bundle (`main.js`) contains only this repository's code plus [@tsvsheet/tsvsheet](https://github.com/tsvsheet/tsvsheet.js); the compute engine is the tsvsheet Go implementation compiled to WebAssembly, running in-process with no I/O of its own.
- **No network access.** The plugin makes no requests; the engine, its Go runtime shim, and all assets are read from the plugin's own directory.
- **No HTML from data.** Grid values — including formula results and error strings — are rendered via `textContent` only, so vault content can never inject markup or script.
- **Maintained, scanned dependencies only.** Dev-time dependencies are held to the same bar as runtime ones: weekly [Dependabot](https://github.com/tsvsheet/tsvsheet.obsidian/network/updates) version updates, a strict `npm audit` (all severities, dev dependencies included) gating every push, and removal over replacement when a package goes unmaintained.

## Automated scanning (live results)

| Measure | Cadence | Live results |
| --- | --- | --- |
| [CodeQL](.github/workflows/codeql.yml) static analysis (`security-extended` queries) | every push/PR + weekly | [workflow runs](https://github.com/tsvsheet/tsvsheet.obsidian/actions/workflows/codeql.yml) · [code scanning alerts](https://github.com/tsvsheet/tsvsheet.obsidian/security/code-scanning) |
| [`npm audit`](.github/workflows/verify.yml) dependency vulnerability scan | every push/PR + weekly | [workflow runs](https://github.com/tsvsheet/tsvsheet.obsidian/actions/workflows/verify.yml) |
| [OSSF Scorecard](.github/workflows/scorecard.yml) supply-chain posture | every push + weekly | [public scorecard](https://scorecard.dev/viewer/?uri=github.com/tsvsheet/tsvsheet.obsidian) · [workflow runs](https://github.com/tsvsheet/tsvsheet.obsidian/actions/workflows/scorecard.yml) |
| [Dependabot](.github/dependabot.yml) alerts + version updates (npm, GitHub Actions) | continuous + weekly | [dependency updates](https://github.com/tsvsheet/tsvsheet.obsidian/network/updates) · [alerts](https://github.com/tsvsheet/tsvsheet.obsidian/security/dependabot) (maintainer view) |
| Secret scanning with push protection | continuous | [alerts](https://github.com/tsvsheet/tsvsheet.obsidian/security/secret-scanning) (maintainer view) |

## Repository constraints

- Every commit is **cryptographically signed**; the organization enforces verified signatures on push.
- GitHub Actions workflows added by this repository grant **least-privilege permissions** (`contents: read` by default) and pin third-party actions **by commit SHA**.
- The `.tsvt` view persists only the engine's canonical source serialization — computed output is never written back to your vault files.
