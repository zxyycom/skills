### Case INDEX-RUNTIME-STAGING-INPUT-001: 稳定拒绝非法暂存输入

Entry:
- `tools/index-runtime/tests/staging.test.ts > rejects invalid staging inputs without changing pending content`
- `bun test --test-name-pattern="^rejects invalid staging inputs without changing pending content$" ./tools/index-runtime/tests/run.ts`

Contract:
- 索引路径必须留在配置根目录内；`selectedIds` 必须是非空、合法且不重复的稳定 ID 集合，每个 ID 必须至少存在于 revision 或工作区索引之一。

Proves:
- 空集合、重复 ID、非法文本、不存在的 ID 和非字符串运行时输入都返回 `selection-invalid`，不会抛出边界异常。
- 逃逸路径返回 `index-path-invalid`；所有非法输入都在 pending 变化前失败。
