# ADR 0001: LLM behind a port; Claude Code CLI as the first adapter

Date: 2026-11-16 · Status: accepted

## Context
The roadmap wants the Claude API (SDK, structured output, caching, Batch). No `ANTHROPIC_API_KEY` is provisioned on the dev machine, but the logged-in Claude Code CLI is, and since 2.1.x it supports `--json-schema` (structured output) and `--max-budget-usd`.

## Decision
`packages/core` defines one port, `Llm.json(request) -> { value, usage }`. Three adapters: `AnthropicLlm` (SDK, `output_config.format`, images as base64, prompt-cached system block), `ClaudeCliLlm` (headless CLI, images via the Read tool), `FakeLlm` (fixtures). `VF_LLM` picks one; with an API key present the default is `anthropic`, otherwise `claude-cli`. The repair loop (`askJson`) and cost logging are provider-independent.

## Consequences
- Prompts, schemas and checks are identical across providers; switching is a config change.
- `ClaudeCliLlm` is a `shortcut:` (no batch, no rate-limit control, cost comes from the CLI's own accounting). Remove it when an API key exists.
- The Anthropic adapter is untested against the live API until a key exists.
