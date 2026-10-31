### Case INVESTIGATION-RENAME-RESOURCE-001: 不安全 owner tree 阻断 rename

Tests:
- `test:c69a2eed4f644c86e2beb155b7ff63bcaf786d55cbf7e1a516745776ee15925d`

Tags:
- `investigation-report`

Contract:
- Investigation rename 预演 owner tree 时必须拒绝符号链接等非安全成员，不能移动报告或 owner。

Proves:
- 含符号链接 owner 的 preflight 返回安全诊断。
- 拒绝后旧 report 和 owner 路径仍存在。
