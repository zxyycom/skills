### Case VERSION-CONTROL-FIRST-PARENT-001: 按顺序列出 first-parent 修订变化并保留空提交

Tests:
- `test:cc585cb785eeddc5dbf2bb576ce57e87f3269bcf41efbc2a8fa0ef10d55dc92d`

Tags:
- `version-control`

Contract:
- first-parent 变化范围使用显式提交 ID，排除 `from`、包含 `to`，按从旧到新返回每个修订，并保留没有路径变化的提交。

Proves:
- 文本路径返回准确增删行数，二进制路径返回两个 `null` 计数，特殊路径保持原值且每个修订内顺序稳定。
- merge 修订相对 first parent 返回变化，非 first-parent 的 side commit 不作为独立结果出现。
- 相同起止修订返回空列表。
