### Case CHANGE-PLAN-CATALOG-SHOW-001: Show 返回生命周期状态
Entry:
- `tools/change-plan/tests/catalog.test.ts > catalog shows lifecycle status`
- `bun test --test-name-pattern="^catalog shows lifecycle status$" ./tools/change-plan/tests/run.ts`
Contract:
- `show` 必须按目录位置区分 active 与 archived Change；active 返回检查结果，archived 只读取原始 artifacts。
Proves:
- Active Change 返回 `active`、有效检查和 proposal 内容。
- 当前结构无效、缺少 design/tasks 且 metadata 无法解析的 archived Change 仍返回 `check: null`、原始 proposal 与空 errors，不产生内容诊断。
- 不存在的 archived 目标返回 `check: null`、全空 artifacts 与目录不可用错误，而不是内容检查结果。
