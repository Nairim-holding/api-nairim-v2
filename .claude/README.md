# .claude Directory Structure

This directory contains project context, decisions, and module documentation for Claude Code sessions.

## Organization

```
.claude/
├── README.md                 ← You are here
├── MEMORY.md                 ← Index of all context (read first in new sessions)
└── planning/                 ← Planning & Financial Control module (2026-05-18)
    ├── INDEX.md              ← Quick summary (read first for this module)
    ├── CONTEXT.md            ← Business rules & schema
    ├── API-CONTRACTS.md      ← JSON examples for all routes
    ├── CODE-CHANGES.md       ← Code modifications made
    ├── DECISIONS.md          ← Why we chose persistence over dynamic calculation
    └── NEXT-STEPS.md         ← Testing checklist & future optimizations
```

## Quick Start (New Session)

1. **First visit to project?** → Read `MEMORY.md`
2. **Working on Planning module?** → Read `planning/INDEX.md` then `planning/CONTEXT.md`
3. **Need to modify Planning code?** → Check `planning/CODE-CHANGES.md`
4. **About to deploy?** → Review `planning/NEXT-STEPS.md` testing checklist

## Token Economy

All documentation here is **condensed and cross-referenced** to minimize re-reading of source code:
- No code snippets duplicated from src/ (use them only when modifying)
- Business rules and decisions documented once
- API contracts captured in JSON format (easy to scan)
- Architectural decisions explained with rationale

**Result**: Future sessions can load context in ~5KB instead of re-reading entire service files.

## Adding New Module Context

When refactoring or documenting a new module:
1. Create a `module-name/` folder
2. Add `INDEX.md` (quick summary)
3. Add domain-specific files (CONTEXT.md, API-CONTRACTS.md, CODE-CHANGES.md, DECISIONS.md)
4. Update this MEMORY.md with link to new module
5. Delete or archive old files once documented

**Goal**: Keep .claude clean, indexed, and fast to navigate.
