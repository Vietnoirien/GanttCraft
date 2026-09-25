# Issue tracker: GitHub

Issues and specs for this repository live in GitHub Issues at `Vietnoirien/GanttCraft`. Use the `gh` CLI from this checkout to create, read, comment on, label, and close issues. Read an issue with its comments before changing it.

## Publishing tickets

Create one issue per ticket in dependency order, with blockers first. Apply the `ready-for-agent` label. Use GitHub's native issue dependencies for blocking edges where available. If the dependency API is unavailable, put `Blocked by: #<number>` in the issue body. A ticket is ready when all of its blocking issues are closed.

## Pull requests as a triage surface

PRs as a request surface: no. Set this to `yes` only if the repository starts treating external PRs as feature requests.

## Wayfinding

Store a map as one issue labelled `wayfinder:map` and its tickets as child issues where GitHub sub-issues are available. Use a task list in the map body otherwise. Claim an unblocked, unassigned ticket before work; record the answer and close it when resolved.
