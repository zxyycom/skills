### Case NATIVE-EXPLICIT-DEPENDENCY-VALIDATION-001: 最终 updater 的临时依赖验证

Tests:
- `test:d4e58e004577bfcb57bf592d5ec838fe34921be21d1f36a1cc7616382ae0c7b7`

Tags:
- `repository-tooling`

Contract:
- 激活前优先使用目标已有依赖；仅缺失已知依赖且 manifest、lock 与当前显式依赖兼容时，可在单次验证子进程临时复用，不复制或安装依赖。

Proves:
- 仓库外隔离目标正常进程缺包时，兼容依赖可供单次验证；返回后正常进程仍缺包且目标未出现 node_modules，目标声明错配被拒绝。
- 此测试不证明干净安装依赖、真实业务程序或完整 bootstrap。
