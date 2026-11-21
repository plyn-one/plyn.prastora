# Browser test executor for this repository

The browser executor for **public `plyn-one/plyn.prastora`** is **GitHub Actions on the standard GitHub-hosted `ubuntu-latest` runner**, with Playwright Chromium. The repository's `.github/workflows/prastora-check.yml` owns the command, triggers and failure reporting; an agent does not select a browser executor or silently fall back to another service.

The `Prastora browser check / chromium` job runs on pushes to `main`, `agent/**` branches and on pull requests, and can also be dispatched for diagnostics. It installs Playwright and Chromium, runs `check.test.mjs`, and when present runs `modules/modules.test.mjs`. Any failing regression fails the job. The resulting check belongs to the exact tested commit; before landing, inspect it via the **Plyń frame's own Klučnik GitHub** connection. A missing, pending or failed check is not a pass.

This is a **public repository only** pilot: it introduces no GitHub Actions workflow for a private repository. No client data, credentials or private-frame content may be copied into these Actions. Tests use the public code and synthetic fixtures. The default Prastora demos remain unchanged; optional modules are tested only when present in the checked branch.

For sites owned by **Legal-Status-UAB**, browser tests are instead executed by that frame's own Klučnik `browser_test` through its own Cloudflare Browser Run account and allowed origins. Running Plyń's repository tests does not validate or spend another frame's site or data. For a website under a different owner, follow its frame's own explicitly configured executor, not a preference of the agent.

The old manual `site/try` exhaustive checker is not a gate: those pages include temporary and historical drafts. Source/site-specific checks (including `check.mjs --site`, metadata, keyboard access and resources) remain separate acceptance obligations; a green workflow does not claim every unrelated deployed site has passed.
