### Case GATE-NATIVE-COMMAND-LAUNCH-001: Gate 通过受控命令边界调用本机工具

Tests:
- `test:036a2631215fc2b04a5e4fc46ed8bc85109450e1fb78f8b375033cd42e9f0137`
- `test:3c9e799da9ce0da7861f192981f3dd7e6e7da5a26840daa2f10ac52b05fb66bc`
- `test:83db6bfe74d5fdbc7d5993f058daa1e2ad9ebaa9cd7b748e95745045466ff228`

Tags:
- `repository-tooling`

Contract:
- Gate 的工具链采集复用环境工具的命令解析与 Windows batch 参数边界；原生执行和 Windows shim 保持参数内容，不存在的程序和不支持的 batch 参数必须明确失败。

Proves:
- 真实子进程收到中文、空格、命令连接字符、感叹号和空参数的原始 argv；Windows 使用真实 batch shim，其他平台使用原生 Node。
- 缺失程序在启动前返回包含命令名的 PATH 诊断；Windows 对百分号扩展和换行参数在启动前拒绝，不作为有效工具输出。
