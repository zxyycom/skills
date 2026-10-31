### Case DECISION-RENAME-RELATIONS-001: Rename 改写正式引用并保留未选候选关系

Tests:
- `test:088d93901e5ba489d70688ef8f767371f2985c8d698f835957a2d025f63b10d9`

Tags:
- `decision-records`

Contract:
- rename 从发布索引发现正式引用者，只改写真正受影响的正式 target 和所选对象；未选候选未来发布时重新验证。

Proves:
- 正式引用者正文与发布索引均保存新 target 和原摘要；未选候选仍保存旧 target 与原摘要。
- 该候选随后 publish 明确拒绝失效旧 ID，候选字节不变。
