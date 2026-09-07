### Case INVESTIGATION-RENAME-RESOURCE-001: 不安全 owner tree 阻断 rename

Tests:
- `test:66e5178f4eb398ef28df387b7865e50f1dbbf5f3a88b02423541cfd0c2a9d35d`

Tags:
- `investigation-report`

Contract:
- Investigation rename 预演 owner tree 时必须拒绝符号链接等非安全成员，不能移动报告或 owner。

Proves:
- 含符号链接 owner 的 preflight 返回安全诊断。
- 拒绝后旧 report 和 owner 路径仍存在。
