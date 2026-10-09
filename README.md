# Branchframe

React + TypeScript + Vite frontend for a traceable creative workflow.

## Development

Requires Node.js 22.12+ (Node.js 24 recommended) and npm.

```sh
npm install
npm run dev
```

On PowerShell with restricted execution policies, use `npm.cmd` in place of `npm`.

## Checks

```sh
npm run lint
npm run typecheck
npm run build
npm run preview
```

## Current scope

The project scaffold and introductory page are initialized. Product workflows,
persistence, backend integration, AI analysis, and automated workflow tests are
not implemented yet. No environment variables or API keys are required.

Requirements are in `branchframe_prd_trd_erd.md`; frontend guidance is in `SOUL.md`.
The UI defaults to English. Provider secrets must remain server-side.

## Git workflow

After each completed feature, run relevant checks, commit the completed change,
and push directly to `origin/main`, as requested by the project owner.
Never force push or commit secrets.
