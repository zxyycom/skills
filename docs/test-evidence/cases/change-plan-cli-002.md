### Case CHANGE-PLAN-CLI-002: CLI 与生成 Node runtime 保持 complete preflight 协议

Tests:
- `test:588ea0ac5beba24773f7753dff2f7775ff44adb2fdc83dc60974397547055082`

Tags:
- `change-plan`

Contract:
- 源码 CLI 和生成 MJS 对 complete preflight 使用相同 JSON 与退出协议。

Proves:
- 两个入口都以成功退出并返回 `outcome: "preflight"`、`changed: false`。
