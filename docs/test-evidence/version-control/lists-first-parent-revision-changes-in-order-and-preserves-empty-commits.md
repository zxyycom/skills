### Case VERSION-CONTROL-FIRST-PARENT-001: 按顺序列出 first-parent 修订变化并保留空提交
Entry:
- `tools/shared/tests/version-control.test.ts > lists first-parent revision changes in order and preserves empty commits`
- `bun test --test-name-pattern="^lists first-parent revision changes in order and preserves empty commits$" ./tools/shared/tests/version-control.test.ts`
Contract:
- first-parent 变化范围必须排除 `from`、包含显式或默认的 `to`，按从旧到新返回每个修订，并保留没有路径变化的提交。
Proves:
- 文本路径返回准确增删行数，二进制路径返回两个 `null` 计数，特殊路径保持原值且每个修订内顺序稳定。
- merge 修订相对 first parent 返回变化，非 first-parent 的 side commit 不作为独立结果出现。
- 相同起止修订返回空列表。
