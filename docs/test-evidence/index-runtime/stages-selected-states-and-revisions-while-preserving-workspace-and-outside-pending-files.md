### Case INDEX-RUNTIME-STAGING-SELECTION-001: 选择性暂存 State 与逐条 Revision

Entry:
- `tools/index-runtime/tests/staging.test.ts > stages selected states and revisions while preserving workspace and outside pending files`
- `bun test --test-name-pattern="^stages selected states and revisions while preserving workspace and outside pending files$" ./tools/index-runtime/tests/run.ts`

Contract:
- 按 ID 暂存必须以 revision 索引为基线，只把选中条目的工作区 state 与逐条来源 revision 成对写入目标索引。

Proves:
- 从 `A0/B0/C0` 与 `A1/B1/C1` 选择 `A/C` 得到 `A1/B0/C1`，且来源指纹使用同一选择。
- 选择顺序不改变确定性目标文本，runtime 方法只接收 selected IDs。
- 工作区索引、领域文件和目标外 pending 内容保持不变。
