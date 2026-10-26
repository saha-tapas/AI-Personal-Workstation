# Git Part 1 — Repository Detection and Status

## Scope

Add read-only Git repository detection and status display for the currently selected local project. This feature does not add staging, commits, branches, remotes, push, pull, clone, GitHub integration, or persistent Git state.

## Backend design

Add a Git service, controller, and route consistent with the existing Express architecture. Mount `GET /api/git/:project/status` from `server/src/index.js`.

The service validates `:project` with the existing `getProjectPath()` helper and uses only the resulting `workspace/<project>` path. Git is invoked through Node child-process APIs with fixed argument arrays; no shell command strings or client-supplied commands are accepted.

The service first runs `git rev-parse --is-inside-work-tree`. A normal non-repository result returns `{ success: true, isRepository: false }`. For a repository it reads the current branch with `git branch --show-current` and porcelain status with `git status --porcelain=v1`. Status lines are parsed into staged, modified, deleted/renamed, and untracked file lists. Git-not-installed and invalid-project errors receive clear, safe responses without exposing environment variables, credentials, or arbitrary filesystem paths.

## Frontend design

Add `frontend/src/features/git/gitApi.js` for the status request and `Git.jsx` for the read-only page. Integrate the existing Git navigation item through `MainContent`, passing the existing `openedProject` selection. The page shows the selected project, loading/error states, repository/non-repository state, branch, clean/changed state, and categorized file lists. A Refresh button reruns the same request. No independent project selector or Git write control is introduced.

Use existing workstation styling patterns and responsive behavior. Terminal files and behavior remain untouched.

## Verification

Add focused backend tests for repository detection, non-repository projects, porcelain parsing, invalid projects, and Git executable errors where practical. Run backend tests and syntax checks, then `npm run build` from `frontend/`. Browser verification will only be reported if performed.
