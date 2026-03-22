# WEPSCLI

`WEPSCLI` is a TUI‑first coding agent CLI built on top of the shared runtime in this monorepo.

It focuses on:

- Provider/profile‑driven configuration on the local machine
- A guided first‑run onboarding flow
- A modern terminal UI chat shell, built with OpenTUI + pi‑tui
- Persisted session history and provider metadata

> Status: experimental / work‑in‑progress. Shell UX, keybindings, and configuration formats may change.

---

## Requirements

- **Node.js**: >= 20.0.0
- **OS**: macOS, Linux, or Windows with a TTY‑capable terminal
- **Bun (optional but recommended)**: if available, WEPSCLI will automatically relaunch the interactive shell under Bun for better OpenTUI compatibility.

---

## Installation & Getting Started

### From npm (global CLI)

```bash
npm install -g wepscli
wepscli --help
```

Or via `npx`:

```bash
npx wepscli
```

### From source in this monorepo

From the repo root, install dependencies if you have not already:

```bash
npm install
```

Then build and run `wepscli`:

```bash
cd D:/WEPsCodingCLI/agents-core/packages/wepscli
npm run build
npm run shell     # or: node dist/cli.js
```

To run the shell explicitly under Bun (if installed):

```bash
npm run shell:bun
```

---

## CLI Usage

The entry binary is called `wepscli`:

```bash
wepscli            # normal startup
wepscli --help     # usage help
wepscli --version  # show CLI version
```

On startup WEPSCLI performs the following steps:

1. Ensure the **agent config directory** exists (see [Configuration directory](#configuration-directory)).
2. Load **provider profiles** from `providers.json`.
3. If no provider profiles are configured, and the terminal is interactive, start the **first‑run onboarding wizard**.
4. If the terminal is interactive and at least one profile exists:
   - Prefer to **relaunch under Bun** (via `bun --conditions=browser --preload @opentui/solid/preload`) when available.
   - Otherwise, start the OpenTUI‑based **WEPSCLI shell** under Node.
   - If the WEPSCLI shell fails to start, optionally fall back to the temporary **workbench shell** (see below).
5. If the terminal is **not** interactive, print a small bootstrap summary and exit.

---

## Configuration directory

WEPSCLI keeps all user configuration, credentials, and runtime metadata under a single agent directory.

### Location

By default:

```text
~/.wepscli/agent
```

You can override this path via the `WEPSCLI_AGENT_DIR` environment variable. `~` and `~/...` are expanded to your home directory. Examples:

```bash
# Use a custom config root
export WEPSCLI_AGENT_DIR="~/my-wepscli/agent"

# Windows PowerShell
$env:WEPSCLI_AGENT_DIR = "C:\\wepscli-agent"
```

### Files inside the agent directory

WEPSCLI currently uses the following files:

- `settings.json`  – reserved for future global app settings.
- `providers.json` – provider profile configuration (see below).
- `auth.json`      – API keys per provider profile, stored as **plain text**.
- `sessions.json`  – persisted shell session history and metadata.
- `startup-error.log` – appended when the shell or fallback workbench fail to start.
- `shell-debug.log`   – debug log emitted by the OpenTUI shell.

All JSON files are accessed through a small `LockedJsonFile` helper which uses `proper-lockfile` to provide safe concurrent access across processes.

> Security note: `auth.json` is intentionally stored in plain text, matching the current design. Only use WEPSCLI on machines you trust, and protect your home directory appropriately.

---

## First‑run onboarding

If no provider profiles exist in `providers.json`, running `wepscli` in an interactive terminal launches a guided onboarding wizard implemented with `@mariozechner/pi-tui`.

The wizard will:

1. **Welcome** – explain that WEPSCLI needs at least one provider profile.
2. **Choose provider family** – select a high‑level API family:
   - `openai` – for OpenAI‑style / OpenAI‑compatible endpoints.
   - `anthropic` – for Anthropic‑style / compatible endpoints.
3. **Provider label** – enter a friendly name used inside the shell (e.g. "My OpenAI Proxy").
4. **Base URL** – enter the absolute endpoint URL. WEPSCLI uses this value **exactly as entered** (no automatic `/v1` normalization).
5. **API key** – paste the API key. It will be stored in `auth.json` under your agent dir.
6. **Connection test** – WEPSCLI performs a small model‑list request as a connectivity probe and reports success or error.
7. **Fetch models** – attempts to fetch a list of models for this profile:
   - On success, shows a picker of discovered models.
   - On failure, lets you enter a model id manually.
8. **Review & save** – show a summary of the profile and selected model, then write:
   - Profile + model metadata into `providers.json`.
   - API key into `auth.json`.
   - Active profile + model selection into the providers config.

If onboarding is aborted, WEPSCLI exits without creating a profile.

When the terminal is not interactive (e.g. CI), WEPSCLI will not start the wizard. Instead, it prints a bootstrap summary of paths and current profile state and exits.

---

## Provider profiles

Provider profiles are managed via the `ProviderProfileService` and stored in `providers.json`. Each profile contains:

- An internal `id` and user‑visible `label`.
- A `family` (e.g. `openai` / `anthropic`).
- An `apiDialect` (currently derived from the family).
- A `baseUrl` for requests.
- A list of discovered `models`.
- Validation metadata (`lastValidatedAt`, `lastValidationStatus`, `lastValidationMessage`).

API keys are stored separately in `auth.json` and looked up by profile id.

The WEPSCLI shell:

- Tracks an **active profile + model** selection.
- Updates the selection when you switch sessions or providers.
- Persists profile changes and model discoveries through `ProviderProfileService` APIs.

You can add additional providers later directly from the shell via the **provider add** flow (see [Slash commands](#slash-commands)).

---

## Session history

The shell keeps a small, capped session history in `sessions.json` via `SessionHistoryService`:

- Each session has an `id`, `title`, `summary`, `state` (`active` | `ready` | `recent`), timestamps, and optional provider/model metadata.
- New sessions are created when you start a new chat or when the shell needs a transient session while initializing.
- The active session is marked, and the previous active session is downgraded to `recent`.
- History is capped (currently at 50 sessions) to keep the file bounded.

On first use in a new agent directory, an initial seed of example sessions is written so the shell has something to render.

---

## WEPSCLI shell (OpenTUI)

After onboarding, running `wepscli` in an interactive terminal starts the OpenTUI‑based chat shell (`WEPSCLIShellApp`).

High‑level behavior:

- **Chat transcript panel** on top: shows messages in the current session.
- **Composer** at the bottom: one‑line input for prompts and slash commands.
- **Status line**: shows agent dir path and active provider/model status.
- **Session‑aware runtime**: prompts are executed through a `WepsAgentRuntime` that integrates with the underlying pi coding agent.

### Basic key behavior

- `Ctrl+C` – exit the shell immediately.
- `Esc` in the composer when it is empty – exit the shell.
- `Tab` – move focus between main area and composer.
- `Esc` while overlays or detail views are open – close them and return to the composer.

### Slash commands

The composer supports a small slash‑command palette. Type `/` to see suggestions, then continue typing to filter.

Built‑in commands:

- `/new` – start a new shell session.
- `/providers` – open the provider picker overlay.
- `/provider add` – open the guided provider setup flow inside the shell.
- `/models` – open the model picker for the active provider.
- `/sessions` – choose from recent sessions.
- `/review` – queue a "review current change" prompt template into the composer.
- `/debug` – queue a "debug current issue" prompt template.
- `/provider-check` – queue a provider configuration inspection task.

Unknown commands are echoed into the timeline as informational system messages.

### Provider & model selection inside the shell

From the shell you can:

- Switch **active provider** and model via overlays (e.g. `/providers`, `/models`).
- Run the **provider add** flow (`/provider add`) to add additional endpoints.
- Associate a session with a specific profile + model; switching sessions restores the associated selection.

All changes are persisted via `ProviderProfileService` and `SessionHistoryService` so subsequent runs of WEPSCLI pick up where you left off.

---

## Fallback workbench shell

If the OpenTUI‑based WEPSCLI shell fails to start, the CLI will:

1. Write details about the failure to `startup-error.log` in the agent directory.
2. Optionally print a warning and then attempt to start the older **workbench** shell implementation.

You can disable the fallback behavior by setting:

```bash
export WEPSCLI_DISABLE_FALLBACK=1
```

In that case, a shell startup failure will propagate as a normal process error.

---

## Networking and proxies

WEPSCLI configures `undici` as its HTTP client and installs `EnvHttpProxyAgent` as the global dispatcher. This means standard environment variables like `HTTP_PROXY`, `HTTPS_PROXY`, and `NO_PROXY` are respected for outbound HTTP(S) requests to your providers.

---

## Development notes

This package is intended to be developed inside the mono‑repo and relies on local `@mariozechner/pi-*` packages.

Useful scripts:

```bash
# Clean build output
npm run clean

# Build once (ensures runtime deps and compiles TypeScript)
npm run build

# Incremental build in watch mode
npm run dev

# Launch the CLI shell from dist
npm run shell

# Shell using Bun + OpenTUI preload
npm run shell:bun

# Minimal smoke tests for OpenTUI rendering (require Bun)
npm run smoke:hello
npm run smoke:panel
npm run smoke:shell-min
```

The published npm package exposes:

- `bin/wepscli` -> `dist/cli.js`
- `main` entrypoint -> `dist/index.js`
- Type declarations -> `dist/index.d.ts`

Changes to runtime behavior should be reflected here in the README to keep user‑facing documentation in sync with the implementation.
