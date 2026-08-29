### Case DECISION-CLI-EVOLVE-RECORDED-FLAG-001: Evolve 的已记录删除参数必须配合 discard
Entry:
- `tools/decision-records/tests/cli-args.test.ts > evolve rejects a recorded-decision deletion flag without discard`
- `bun test --test-name-pattern="^evolve rejects a recorded-decision deletion flag without discard$" ./tools/decision-records/tests/run.ts`
Contract:
- `--delete-recorded-decision` 仅确认 `--discard <decision-id>` 选定目标的删除，不是独立演进选项。
Proves:
- evolve 仅传该参数时以退出码 2 在 Commander 参数边界拒绝，stdout 为空，stderr 给出稳定的 `--delete-recorded-decision requires --discard <decision-id>` 诊断。
