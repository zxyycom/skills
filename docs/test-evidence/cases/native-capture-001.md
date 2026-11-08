### Case NATIVE-RELEASE-CAPTURE-001: 同次 pending 捕获源码、生成闭包与 skill

Tests:
- `test:3df6b11970f11e3a20a6ba0df6c71ba5c2e2539a9991bba5b0f0d8f082f7dd8f`

Tags:
- `repository-tooling`

Contract:
- 原生发布准备从同一 Git pending 读取收集源码与 skill，不以未暂存工作树内容或后续暂存变化替换已捕获字节。

Proves:
- 私有 Git fixture 的暂存源码、Schema 和 skill 内容被保留，源码摘要与固定独立预期一致。
- 捕获后修改 pending 不改变已取得的内容，新捕获反映不同源码摘要。
- 缺少必需的 Cargo 输入时拒绝；非 Windows fixture 另验证源码符号链接被拒绝。
