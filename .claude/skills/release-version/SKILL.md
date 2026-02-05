---
name: release-version
description: Use when asked to commit, release, bump version, update changelog, tag, or push a new plugin version. Also use when asked to "ship it", "cut a release", or prepare a version for WordPress.org deployment.
---

# Release Version

Commit staged work, bump the version, update the changelog, tag, and push — triggering WordPress.org deployment via GitHub Actions.

## Version Locations (all 3 must match)

| File | Pattern |
|------|---------|
| `stacksuite-sales-manager-for-woocommerce.php` | `* Version: X.Y.Z` (header comment) |
| `stacksuite-sales-manager-for-woocommerce.php` | `define( 'AISALES_VERSION', 'X.Y.Z' );` |
| `readme.txt` | `Stable tag: X.Y.Z` |

## Changelog Format

In `readme.txt` under `== Changelog ==`, prepend a new section:

```
= X.Y.Z =
* Fixed: Description of fix
* Added: Description of addition
* Improved: Description of improvement
* Removed: Description of removal
```

Prefix categories: `Fixed`, `Added`, `Improved`, `Removed`, `Changed`.

## Commit Message Convention

```
type(X.Y.Z): short description

Optional body explaining why.
```

Types from git log: `fix`, `hotfix`, `release`, `feat`, `docs`, `ui`.

## Tag Convention

Bare version numbers without `v` prefix: `1.6.4`, not `v1.6.4`.

## Steps

1. **Read current version** from the 3 locations above
2. **Determine new version** — bump patch (X.Y.Z+1) unless user specifies otherwise
3. **Update all 3 version locations** to the new version
4. **Add changelog entry** in `readme.txt` — prepend under `== Changelog ==`
5. **Stage only relevant files** — the modified source files + `readme.txt` + main plugin file
6. **Commit** with conventional message format
7. **Tag** with bare version number
8. **Push** with `git push origin main --tags`

## Common Mistakes

- Forgetting one of the 3 version locations (especially `Stable tag` in readme.txt) — WordPress.org won't serve the update
- Using `v` prefix on tags — breaks the GitHub Actions deployment workflow
- Staging unrelated untracked files (check `git status` first)
