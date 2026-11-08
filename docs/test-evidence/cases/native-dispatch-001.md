### Case NATIVE-DISPATCH-PROTOCOL-001: 仓库原生调度器透传进程协议

Tests:
- `test:3b07ce0a6bd5d35153ec832b02c81494f1370882f02da95d71e2c95e5f6209c1`

Tags:
- `repository-tooling`

Contract:
- 候选调度器不解释业务参数和输出，缺失运行时应给出显式准备指引。

Proves:
- 隔离进程中 argv、stdout、stderr 和非零退出码原样传递；缺 receipt 时输出可行动诊断。
- shell fixture 在 Windows 显式跳过，不证明该平台进程协议或信号传递。
