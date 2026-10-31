### Case INDEX-RUNTIME-SELECTED-SYNC-001: selected sync proves the complete projection before publishing it

Tests:
- `test:620c6799582e29f62fe4561dbd71e1902aa345bf0e40231effbd155a12c31c68`

Tags:
- `index-runtime`

Contract:
- selected sync 始终构建完整 candidate，只在全部变更 ID 已被选择且集合 metadata 未变时发布完整索引。

Proves:
- 未选择的来源变化返回完整 changed ID 集合且不改写 baseline 字节。
- 即使来源 revision 未变，未选择的 state 漂移仍被拒绝且不改写 baseline。
- selected check 只报告 scoped stale；selected preview 对合法变化成功且保留 baseline，selected write 发布的字节等于完整 candidate 的规范序列化。
- collection metadata 变化阻断 selected write 并保持当前索引不变。
- 新增、删除与 ID rename 分别要求覆盖对应的新、旧或旧+新 ID；额外未变化的选择合法，未知或重复 ID 失败。
