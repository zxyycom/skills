### Case ENV-BUN-RUNTIME-001: 环境复用可运行的 Bun 而不限制版本

Tests:
- `test:c8d706cc2bf35caa909556317bbd2220a849971f2b150f516d4e10b63f3d57f8`

Tags:
- `repository-tooling`

Contract:
- 环境入口不要求 manifest 声明 Bun 版本；可运行的 Bun 可以直接复用，不因版本号不同被拒绝或触发替换安装。

Proves:
- 不含 `engines.bun` 的 fixture 在其他前置条件准备好时，分别以 Bun 1.4.1、1.4.2 和 1.4.4 通过 setup 与后续 check，输出实际版本为 ready。
- 三组 setup/check 的工具日志均没有 npm 或 Corepack 调用，不会为版本号不同安装或切换 Bun。
