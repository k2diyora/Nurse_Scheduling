# Nurse Scheduling Frontend

Frontend application for managing nurse scheduling workflows in MedCare.

This app provides:
- Role-based login experience (admin and nurse)
- Admin dashboard for nurses, requests, and shift management
- Nurse dashboard for assigned patient visibility
- Account settings and password update flows

## Tech Stack

- React (Create React App)
- Material UI (MUI)
- React Router
- Jest + React Testing Library

## Prerequisites

- Node.js 20.x (recommended)
- npm 10+ (or compatible with your Node version)

## Getting Started

1. Install dependencies:

```bash
npm ci
```

2. Start development server:

```bash
npm start
```

3. Open the app at:

- http://localhost:3000

## Available Scripts

- `npm start`
  - Runs the app in development mode.

- `npm test`
  - Runs tests in watch mode.

- `npm run test:coverage`
  - Runs tests once with coverage output.
  - Enforces strict global coverage thresholds.

- `npm run build`
  - Creates an optimized production build in `build/`.

## Testing and Coverage

Coverage is configured in package-level Jest config and currently enforces:
- 100% statements
- 100% branches
- 100% functions
- 100% lines

Coverage output is generated under:
- `coverage/`
- `coverage/lcov-report/index.html` (HTML report)

## CI (GitLab)

CI workflow file:
- `.gitlab-ci.yml`

Pipeline stages:
1. `verify` (sanity job to confirm runner availability)
2. `build` (install dependencies and run production build)

Runner setup in GitLab:
1. Open project `Settings` -> `CI/CD` -> `Runners`.
2. Ensure at least one runner is online and enabled for the project.
3. If your runner is untagged, no extra configuration is needed.
4. If your runner requires tags, add CI/CD variable:
  - Key: `CI_RUNNER_TAG`
  - Value: your runner tag (example: `docker`)

How the pipeline chooses jobs:
- If `CI_RUNNER_TAG` is empty: untagged jobs run.
- If `CI_RUNNER_TAG` is set: tagged jobs run with that tag.

If jobs stay in `pending`, the project has no eligible online runner.

## Project Structure

```text
src/
  components/      Shared UI components (dialogs, route guards)
  pages/           Feature pages (Login, AdminDashboard, NurseDashboard, AccountSettings)
  services/        API and data service layer
  utils/           Auth/session helper logic
  tests/           Unit and integration tests
```

## Environment Notes

The project defaults API base URLs to localhost endpoints in source.
If backend location changes, update service configuration values accordingly.

## Troubleshooting

- If tests fail after dependency changes, run a clean install:

```bash
# PowerShell
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install
```

- If coverage command exits non-zero, check uncovered paths in:

- `coverage/lcov-report/index.html`

## Contributing

1. Create a feature branch.
2. Keep tests passing locally.
3. Ensure coverage and build pass before opening a pull request.
