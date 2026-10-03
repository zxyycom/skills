### Case LIGHTWEIGHT-JUDGMENT-CLI-013: 独立分发与导入

Tests:
- `test:25516a261d481a6d8392122e6b3ac43b8353c328f783a826a3b45568037e9a10`

Tags:
- `lightweight-judgment`

Contract:
- 自包含 mjs 可离开仓库依赖运行；import 无配置、网络或输出副作用。

Proves:
- 临时独立目录中的 Node 子进程完成 help、stdin dry-run 和错误退出检查，import 只产生测试标记；非法 UTF-8 stdin 返回 input，结束时目录仅有预置 mjs 与配置，不产生隐式输出文件。
