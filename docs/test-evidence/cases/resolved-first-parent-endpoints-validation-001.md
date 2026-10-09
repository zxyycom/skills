### Case RESOLVED-FIRST-PARENT-ENDPOINTS-VALIDATION-001: 已解析历史入口拒绝非提交 ID

Tests:
- `test:7526a3564691ccc3213440f3da5b3a8bf7ff62f146db745d49732fb3917444eb`

Tags:
- `git-integration`
- `version-control`

Contract:
- 已解析 first-parent 范围的端点必须满足 Git 对象 ID 格式，不能以引用名或命令选项代替。

Proves:
- HEAD、--all、空字符串和普通文本分别出现在起点或终点时，入口均拒绝并返回 operation-failed。
