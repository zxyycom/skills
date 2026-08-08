### Case CHANGE-PLAN-CLI-LIFECYCLE-OUTPUT-001: 生命周期 CLI 保持输出通道与错误码
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI lifecycle output preserves result channels and error codes`
- `bun test --test-name-pattern="^CLI lifecycle output preserves result channels and error codes$" ./tools/change-plan/tests/run.ts`
Contract:
- 生命周期命令的文本成功写 stdout、文本失败写 stderr；JSON 成功和失败都写 stdout。成功结果只返回 action、来源阶段和写入后的 metadata，失败结果返回诊断、稳定 `errorCode` 和错误消息，不嵌入 check 或 assessment。
Proves:
- `resume` 的文本与 JSON 成功均退出 0 且 stderr 为空，JSON 直接返回空基线 plan metadata 且没有 `check` 或 `errorCode`；非法来源阶段的文本与 JSON 失败均退出 1，分别在 stderr 和 JSON 中提供 `invalid-source-stage`、诊断及行动提示，且不返回 check、assessment 或 Change 路径。
