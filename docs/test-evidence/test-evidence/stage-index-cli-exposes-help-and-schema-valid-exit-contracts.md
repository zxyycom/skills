### Case TEST-EVIDENCE-STAGE-CLI-001: 暂存 CLI 保留帮助与机器退出契约

Entry:
- `tools/test-evidence/tests/staging.test.ts > stage-index CLI exposes help and schema-valid exit contracts`
- `bun test --test-name-pattern="^stage-index CLI exposes help and schema-valid exit contracts$" ./tools/test-evidence/tests/run.ts`

Contract:
- 分发 CLI 必须展示 `stage-index` 的 Case 选择与领域文件边界，并区分参数失败与操作失败。

Proves:
- help 显示必需的可变 Case ID 参数、领域文件非目标和退出码语义。
- 缺少必需参数返回 usage 失败；非法或重复 ID 以退出码 `2` 返回符合结果 Schema 的 JSON 失败。
- 版本仓库操作失败以退出码 `1` 返回符合结果 Schema 的 JSON 失败，保留 `not-repository` 的结构化版本控制事实，且不向 stderr 混入诊断。
