### Case RECORD-NATIVE-RELEASE-WORKFLOW-001: 发布与验收输入互斥

Tests:
- `test:c5949535a80d9dcf73e74262e688ad6803ae325c3c49ab5c0c299aad2122ac52`

Contract:
- 手动触发必须同时提供有效验收 release ID 与 revision，或两者都不提供进入发布路径。

Proves:
- 读取真实 workflow 并执行 Bash 输入验证，核对六组有效与无效组合及发布、在线验收互斥条件；Windows 跳过此 Bash 测试。
