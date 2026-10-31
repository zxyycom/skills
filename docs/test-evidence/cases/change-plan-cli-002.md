### Case CHANGE-PLAN-CLI-002: CLI 与生成 Node runtime 保持 finalize preflight 协议

Tests:
- `test:6eed9df210929e58b3d35a6a501b72f34f5dad3c56e9deecb469a670488a970b`

Tags:
- `change-plan`

Contract:
- 源码 CLI 和生成 MJS 对 finalize preflight 使用相同 JSON 与退出协议。

Proves:
- 两个入口都以成功退出并返回 `outcome: "preflight"`、`changed: false`。
