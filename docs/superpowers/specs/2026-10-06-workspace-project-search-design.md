# Workspace-wide Project Search — Part 1

## Scope

Add basic content search for the currently active project. Search is limited to file contents, returns project-relative paths with matching line numbers and short previews, and opens results through the existing Project → Code Editor flow.

This change does not alter project creation, deletion, metadata, storage structure, selection semantics, project routes, or project APIs.

## Backend design

Add a single project-scoped search endpoint at `GET /api/files/:project/search?q=...`.

The endpoint will reuse the existing file-service project-root validation and recursively walk only that project directory. It will inspect only the existing supported text/code extensions, skip all other files without decoding them, and return project-relative paths only. Every requested path remains under the validated project root; traversal and unrelated absolute paths are rejected by the existing path-boundary helpers.

Recursive traversal must not follow symbolic links, junctions, or other filesystem reparse points that could resolve outside the validated project root. Search must remain physically scoped to the active project directory.

The response will contain matching records with `path`, one-based `line`, and a bounded `preview` string. Search is literal substring matching only for this Part; regex, replacement, filters, and case-sensitive controls are out of scope.

## Frontend design

Add a small search control in the active-project workspace, using existing project context. The frontend calls the search endpoint and renders result rows containing the relative path, line number, and preview.

Selecting a result calls the existing `handleOpenFile(file, line)` flow. No second editor state or navigation mechanism is introduced; existing tab reuse, dirty-tab behavior, and cursor targeting remain authoritative.

Search state is local to the active workspace view. Changing projects clears or replaces the search context through the existing active-project lifecycle.

## Error and safety behavior

Empty queries do not search. Backend errors are surfaced using the existing frontend error pattern. Binary and unsupported files are skipped. Results never expose absolute filesystem paths. The project name is validated by the existing project-root helper before any traversal or read occurs.

## Verification

Run the frontend lint and production build, plus focused backend tests for project scoping, traversal rejection, text matching, and binary/unsupported-file skipping if the repository test setup supports them. Do not perform browser verification for this Part.

## Explicit exclusions

No Project Manager changes, project data migration, storage changes, package additions, Terminal parser changes, UI redesign, regex search, replace, filters, or advanced search features.

## Filesystem link safety

The recursive search must not follow symbolic links, junctions, or other filesystem reparse points that could resolve outside the validated project root. Search must remain physically scoped to the active project directory.


