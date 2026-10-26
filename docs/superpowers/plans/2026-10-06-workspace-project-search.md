# Workspace-wide Project Search — Part 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add literal content search scoped to the active project, returning safe project-relative file/line previews that open through the existing Code Editor flow.

**Architecture:** Add one project-scoped search endpoint backed by the existing file-service project-root validation. The service recursively scans only supported text/code files, refuses symlinks/junctions/reparse points, and returns relative matches. The frontend adds local search state and renders results in the active project workspace, routing result clicks through `Projects.handleOpenFile(path, line)`.

**Tech Stack:** React 19, Vite, Node.js/Express, `fs/promises`, existing frontend fetch APIs.

**Spec:** `docs/superpowers/specs/2026-10-06-workspace-project-search-design.md`

## Global Constraints

- Search only the currently active project.
- Return project-relative paths, one-based line numbers, and bounded preview text.
- Read only supported text/code extensions; skip binary and unsupported files.
- Do not follow symbolic links, junctions, or filesystem reparse points.
- Preserve existing project-root and project-relative path validation.
- Do not modify Project Manager logic, data, storage, selection, routes, or APIs.
- Do not modify Terminal parser behavior.
- Do not add packages or modify `package.json`.
- Do not implement regex search, replace, filters, or advanced controls.
- Do not perform browser verification.

## Review Focus

- Reparse-point directory entries must be skipped before recursion; test with a symlink/junction fixture where supported.
- A matching file must be returned with a one-based line and bounded preview; test multiple matching lines in one file.
- Binary/unsupported files must not be decoded; test a binary fixture and an unsupported extension.
- Traversal and absolute project inputs must fail through existing project validation; test invalid project names and paths.
- Result clicks must use existing tab reuse and cursor targeting; test the frontend API/result shape and `handleOpenFile` call path without creating a second editor state.

### Task 1: Add secure project-scoped search service

**Files:**
- Modify: `server/src/services/fileService.js`
- Test: `server/test/fileService.test.js` if present; otherwise create the smallest focused service test file following the repository’s existing Node test conventions.

**Interfaces:**
- Consumes: existing `getProjectRoot(project)` and filesystem helpers.
- Produces: `searchProject(project, query) -> Promise<Array<{ path: string, line: number, preview: string }>>`.

- [ ] **Step 1: Write failing service tests** for literal matching, multiple lines, project-relative paths, unsupported/binary skipping, traversal rejection, and reparse-point skipping.
- [ ] **Step 2: Run the focused backend test and confirm it fails for the missing search function/behavior.**
- [ ] **Step 3: Implement `searchProject(project, query)` in `server/src/services/fileService.js`.** Validate the project through `getProjectRoot`; reject empty/non-text queries; walk directory entries without following links, junctions, or reparse points; inspect only the existing supported text/code extensions; read UTF-8 text files; emit one result per matching line with a bounded preview; normalize returned separators to `/`.
- [ ] **Step 4: Run focused service tests and confirm all pass.**

### Task 2: Expose the minimal search endpoint

**Files:**
- Modify: `server/src/controllers/fileController.js`
- Modify: `server/src/routes/fileRoutes.js`
- Test: existing route/controller test location, or a focused endpoint test following repository conventions.

**Interfaces:**
- Consumes: `searchProject(project, query)` from Task 1.
- Produces: `GET /api/files/:project/search?q=<literal>` returning `{ success: true, results }`.

- [ ] **Step 1: Write the failing endpoint test** for successful scoped search and service errors.
- [ ] **Step 2: Run the focused endpoint test and confirm it fails because the route is absent.**
- [ ] **Step 3: Add the controller and route before the existing `GET /api/files/:project` listing route if needed to avoid route ambiguity.** Return only relative result data and existing-style error responses.
- [ ] **Step 4: Run focused endpoint tests and confirm they pass.**

### Task 3: Add the frontend search API and workspace UI

**Files:**
- Modify: `frontend/src/features/files/filesApi.js`
- Modify: `frontend/src/features/projects/Projects.jsx`

**Interfaces:**
- Consumes: `GET /api/files/:project/search?q=...` from Task 2.
- Produces: local active-project search input, loading/error state, and result rows calling `handleOpenFile({ name, path }, line)`.

- [ ] **Step 1: Add the frontend API test or focused request contract check** for successful results and API errors, following the project’s available frontend test conventions.
- [ ] **Step 2: Implement `searchProject(project, query)` in `filesApi.js`** using URL encoding and the existing response/error pattern.
- [ ] **Step 3: Add local search state and a compact search/results block to the active-project branch of `Projects.jsx`.** Submit literal queries only, clear stale results when the active project changes, display relative path/line/preview, and route result clicks through the existing `handleOpenFile` flow.
- [ ] **Step 4: Verify result clicks do not create duplicate editor tabs and preserve existing dirty-tab behavior by reusing `handleOpenFile`.**

### Task 4: Run full verification and scope audit

**Files:**
- No planned source changes.

- [ ] **Step 1: Run the full backend test command used by the repository.**
- [ ] **Step 2: Run `npm run lint` from `frontend`.**
- [ ] **Step 3: Run `npm run build` from `frontend`.**
- [ ] **Step 4: Confirm `package.json` is unchanged, no packages were added, backend changes are limited to the search endpoint/service, Project Manager files/routes/APIs are untouched, no debug logging exists, and browser verification was not performed.**

