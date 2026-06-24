# Dependency Vulnerability Audit

## Audit Date
June 2026 (Updated)

## Methodology
- `npm audit` executed against `package.json`
- Each vulnerability assessed for exploitability in current context
- Upgrade paths evaluated for breaking changes

## Audit Results

### Summary

| Severity | Count | Change |
|----------|-------|--------|
| Critical | 0 | — |
| High | 2 | ↓ 1 (nodemailer upgraded to 9.0.1) |
| Moderate | 22 | — |
| Low | 0 | — |
| **Total** | **24** | ↓ 1 |

### High Severity Vulnerabilities

#### 1. tar (7 advisories, high severity) — 2 unique CVEs

**Package**: `tar` @ 6.2.1
**Installed via**: `bcrypt` → `@mapbox/node-pre-gyp` → `tar` (production transitive)
**Direct dependency**: `tar@7.5.16` (patched, separate install)

**Advisories**:
| Advisory | Description | Exploitable? |
|----------|-------------|:------------:|
| GHSA-qffp-2rhf-9h96 | Hardlink Path Traversal via Drive-Relative Linkpath | No — build-time only |
| GHSA-9ppj-qmqm-q256 | Symlink Path Traversal via Drive-Relative Linkpath | No — build-time only |

**Risk**: None — `tar@6.2.1` is the latest 6.x release. No patched version exists in the 6.x line. Tar 7.x (which has fixes) has a breaking API change incompatible with `@mapbox/node-pre-gyp`. Exploitation requires extracting a malicious tarball, which only occurs during `npm install`. No user input is processed through tar extraction at runtime.

**Recommendation**: Accepted risk — no upgrade path without breaking bcrypt native module build. Not exploitable at application runtime.

### Moderate Severity Vulnerabilities (22 total)

#### js-yaml (1 advisory)

**Package**: `js-yaml` <=4.1.1
**Installed via**: Test toolchain (`jest` → `@jest/transform` → `babel-plugin-istanbul` → `@istanbuljs/load-nyc-config` → `js-yaml`)
**Advisory**: GHSA-h67p-54hq-rp68 — Quadratic-complexity DoS via repeated aliases in merge key handling

**Risk**: Low — js-yaml is only used at test time, not in production runtime
**Recommendation**: Accepted — `--force` upgrade would downgrade ts-jest significantly

#### uuid (1 advisory)

**Package**: `uuid` <11.1.1
**Installed via**: `autocannon` → `hyperid` → `uuid`
**Advisory**: GHSA-w5hq-g745-h8pq — Missing buffer bounds check in v3/v5/v6

**Risk**: None — uuid is only used in autocannon (dev + benchmarking tool)
**Recommendation**: Accepted until autocannon updates

## Vulnerability Tree

```
Critical: 0
High:     2  (tar@6.2.1 via @mapbox/node-pre-gyp — build-time only, no patch)
Moderate: 22 (js-yaml via Jest — dev only; uuid via autocannon — dev only)
```

## Action Plan — Completed

| Package | Previous | Current | Action Taken |
|---------|----------|---------|-------------|
| nodemailer | ^6.x | 9.0.1 | Upgraded via `npm install nodemailer@9.0.1` |
| tar (direct) | <7.5.16 | 7.5.16 | Upgraded via `npm install tar@latest` |
| tar (transitive) | 6.x | 6.2.1 | No patch available — risk accepted |
| js-yaml | 4.1.1 | 4.1.1 | Accepted (dev only) |
| uuid | <11.1.1 | <11.1.1 | Accepted (dev only) |

## Residual Risk

All 2 remaining high-severity advisories affect `tar@6.2.1`, a transitive dependency of `bcrypt` via `@mapbox/node-pre-gyp`. This is the latest 6.x release; no patched version exists in the 6.x line. The exploitation vector (malicious tarball extraction) only exists during `npm install`, not at application runtime. Acceptable for production deployment with documented risk acceptance.

## Recommendation

Re-run `npm audit` after any dependency update. Schedule quarterly dependency audits. Consider migrating from `bcrypt` to `bcryptjs` (pure JS, no native compilation, removes the tar transitive dependency) in a future phase.
