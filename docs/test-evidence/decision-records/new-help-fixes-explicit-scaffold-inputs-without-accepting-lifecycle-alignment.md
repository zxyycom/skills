### Case DECISION-CLI-NEW-HELP-001: New 帮助固定显式 scaffold 输入

Entry:
- `tools/decision-records/tests/cli-args.test.ts > new help fixes explicit scaffold inputs without accepting lifecycle alignment`
- `bun test --test-name-pattern="^new help fixes explicit scaffold inputs without accepting lifecycle alignment$" ./tools/decision-records/tests/run.ts`

Contract:
- `new` 只接收创建 scaffold 所需的显式 metadata、可选直接关系和可选预演 alignment；它不得接收建立用的 `--alignment`。

Proves:
- 帮助公开 title、purpose、background、decision、重复 tag、重复 relation 与 preflight alignment。
- relation 明确声明当前 candidate 的完整直接前序集合，而不误称为已选后继的覆盖。
- 帮助区分 scaffold/body readiness 的机械含义，并且不公开生命周期 alignment 选项。
