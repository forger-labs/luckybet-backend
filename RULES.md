# RULES.md
> Single source of truth for coding agents working in this repository.
> Read this file in full before making any changes.

---

## Architecture context

This is an Nest-based Solana project composed of multiple services to listen to events in blockchain and comunicate users.

---

## Development rules

- Follow strict filename rules: 
  - Controllers follow <name>.controller.ts
- Folder structure has to be:
  - service/ 
    - |
    - |-app/
    - |  |-schemas/
    - |  |-<service>Core.ts
    - |
    - |-adapters/
    - |  |-drivers/
    - |  |-drivens/
    - |
    - |-ports/
    - |  |-drivers/
    - |  |-drivens/
    - |
    - |-entities
    - |-<service>.module.ts
- DTOs are always store in <service>/app/schemas
- Validations use TypeORM Zod
- Don't repeat yourself

---
## Code quality checks

Run in this exact order after every change. A failure in any step blocks the next.

1. yarn lint
2. yarn test:unit
3. yarn test:e2e
4. yarn build:clean
5. yarn build 

---

## Code exploration (CodeGraph)

**Use CodeGraph FIRST** before grep, find, or manual file reading when locating or understanding code.

If a `.codegraph/` directory exists at repo root:
- **MCP tool** (preferred): `codegraph_explore` — returns verbatim source + call paths, including dynamic dispatch.
- **Shell fallback**: `codegraph explore "<symbol or question>"`

If no `.codegraph/` directory exists: init codegraph.
If codegraph could not be initiated, skip it.

## Engram context

Use Engram MCP to get context of luckybet. The project name is in file /.engram/config.json
