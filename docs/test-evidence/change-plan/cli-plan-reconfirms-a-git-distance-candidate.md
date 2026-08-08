### Case CHANGE-PLAN-CLI-RECONFIRM-001: Plan CLI 重新确认 Git 距离候选
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI plan reconfirms a Git-distance candidate`
- `bun test --test-name-pattern="^CLI plan reconfirms a Git-distance candidate$" ./tools/change-plan/tests/run.ts`
Contract:
- `shelve-candidate` 经人工复核仍可实施时，`plan` 必须把当前 HEAD 确认为新基线，而不强制先进入 shelved。
Proves:
- 九个项目提交产生候选后，`plan` 将其恢复为零距离 `current`；current plan 不能重复确认，重新确认后的 plan 可以进入 implementation。
