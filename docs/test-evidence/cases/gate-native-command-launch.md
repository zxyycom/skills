### Case GATE-NATIVE-COMMAND-LAUNCH-001: Gate 通过受控命令边界调用本机工具

Tests:
- `test:3f5a6dea9f83b8c7c8d539a49f24c8418c6b5cb1795ba195cfc846c1ae8311d7`
- `test:cf4d3ad4e72eb86b5daea72670d6f78f1676f30cabeb93e136f4dd7e77efc1ea`
- `test:f2d0b6d0a1e66b34ac4a7b5e1d4a6634af9e9c7b77a3f8ca7ce3460d568b6d9f`

Tags:
- `repository-tooling`

Contract:
- Gate 的工具链采集复用环境工具的命令解析与 Windows batch 参数边界；原生执行和 Windows shim 保持参数内容，不存在的程序和不支持的 batch 参数必须明确失败。

Proves:
- 真实子进程收到中文、空格、命令连接字符、感叹号和空参数的原始 argv；Windows 使用真实 batch shim，其他平台使用原生 Node。
- 缺失程序在启动前返回包含命令名的 PATH 诊断；Windows 对百分号扩展和换行参数在启动前拒绝，不作为有效工具输出。
