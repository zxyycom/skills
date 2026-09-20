### Case CHANGE-PLAN-CLI-002: CLI 与生成 Node runtime 保持 finalize preflight 协议

Tests:
- `test:2b602513dddd102621a1401a5406dd7f5d480f326b292669405d674549515846`

Tags:
- `change-plan`

Contract:
- 源码 CLI 和生成 MJS 对 finalize preflight 使用相同 JSON 与退出协议。

Proves:
- 两个入口都以成功退出并返回 `outcome: "preflight"`、`changed: false`。
