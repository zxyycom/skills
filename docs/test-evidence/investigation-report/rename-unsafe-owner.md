### Case INVESTIGATION-RENAME-RESOURCE-001: 不安全 owner tree 阻断 rename

Entry:
- `tools/investigation-report/tests/rename.test.ts > Investigation rename rejects an unsafe owner tree before moving its report or resources`
- `bun test --test-name-pattern="^Investigation rename rejects an unsafe owner tree before moving its report or resources$" ./tools/investigation-report/tests/run.ts`

Contract:
- Investigation rename 预演 owner tree 时必须拒绝符号链接等非安全成员，不能移动报告或 owner。

Proves:
- 含符号链接 owner 的 preflight 返回安全诊断。
- 拒绝后旧 report 和 owner 路径仍存在。
