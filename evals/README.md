# evals

- `fixtures/`: the answers `FakeLlm` returns (`VF_LLM=fake`, smoke test): `script.json`, `scene.json`, `formula.json`. Keep them valid against `@vf/contracts`; the contract test parses them.
- `script/`: the LLM eval set for `vf eval` (roadmap GĐ 3, not built yet): ~20 cases measuring first-try validity, rule compliance, cost and run-to-run similarity.
