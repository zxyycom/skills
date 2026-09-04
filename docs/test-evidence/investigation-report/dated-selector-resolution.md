### Case INVESTIGATION-DATED-SELECTOR-001: 普通 Investigation selector 先解析日期 ID 再查询名称

Entry:
- `tools/investigation-report/tests/index-query.test.ts > ordinary Investigation selectors use the standard ID parser before name lookup`
- `bun test --test-name-pattern="^ordinary Investigation selectors use the standard ID parser before name lookup$" ./tools/investigation-report/tests/run.ts`
- `tools/investigation-report/tests/staging.test.ts > stage-index resolves a unique Investigation name after one Markdown suffix`
- `tools/investigation-report/tests/staging.test.ts > stage-index treats a standard Investigation ID as exact`
- `tools/investigation-report/tests/staging.test.ts > stage-index rejects an ambiguous Investigation name`
- `tools/investigation-report/tests/staging.test.ts > stage-index resolves a baseline-only Investigation name as a deletion`
- `tools/investigation-report/tests/staging.test.ts > stage-index resolves a workspace-only Investigation name as an addition`

Contract:
- `show` 等普通 Investigation selector 只去除一个大小写不敏感 `.md`，随后精确识别 calendar-valid `YYMMDD-name`；仅失败时使用索引中的 exact name key。

Proves:
- 语义 name、标准 ID 和 `.md` 输入均收敛到完整 ID，且读取不依赖语义 sourcePath basename。
- 重复 name 的候选以二进制 ID 顺序返回，非法日期前缀按 name 成功解析，不存在的标准 ID 不回退。
- `stage-index` 在同一严格 HEAD/工作区索引事务且集合契约一致后，用两侧 state.name 并集解析 selector；它支持单侧删除和单侧新增，并在歧义或精确 ID 缺失时不写 pending。
