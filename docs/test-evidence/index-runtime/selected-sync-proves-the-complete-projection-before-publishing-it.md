### Case INDEX-RUNTIME-SELECTED-SYNC-001: selected sync proves the complete projection before publishing it

Entry:
- `tools/index-runtime/tests/runtime.test.ts > selected sync proves the complete projection before publishing it`
- `bun test --test-name-pattern="^selected sync proves the complete projection before publishing it$" ./tools/index-runtime/tests/run.ts`

Contract:
- selected sync 始终构建完整 candidate，只在全部变更 ID 已被选择且集合 metadata 未变时发布完整索引。

Proves:
- 未选择的来源变化返回完整 changed ID 集合且不改写 baseline 字节。
- selected check 只报告 scoped stale；selected write 发布的字节等于完整 candidate 的规范序列化。
- collection metadata 变化阻断 selected write 并保持当前索引不变。
- 新增、删除与 ID rename 分别要求覆盖对应的新、旧或旧+新 ID；额外未变化的选择合法，未知或重复 ID 失败。
