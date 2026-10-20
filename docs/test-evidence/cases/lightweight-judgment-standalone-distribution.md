### Case LIGHTWEIGHT-JUDGMENT-CLI-013: 独立分发与导入

Tests:
- `test:530e57a75aff4773c3151f245c6e522d969970159649614aad342ab445839ebe`

Tags:
- `lightweight-judgment`

Contract:
- 完整 TS 分发可按随包锁文件 frozen 安装后独立运行；import 无配置、网络或输出副作用。

Proves:
- 临时独立目录中的 Node 子进程完成 help、stdin dry-run 和错误退出检查，import 只产生测试标记；非法 UTF-8 stdin 返回 input，除显式安装的依赖与预置 TS/配置外不产生隐式输出文件。
