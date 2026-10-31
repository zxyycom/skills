### Case LIGHTWEIGHT-JUDGMENT-CLI-013: 独立分发与导入

Tests:
- `test:4eb8442737dedf1b2a82aaff7ef9adac9dd5bc3aca4ad3665b6289f8bb96907f`

Tags:
- `lightweight-judgment`

Contract:
- 完整 TS 分发可按随包锁文件 frozen 安装后独立运行；import 无配置、网络或输出副作用。

Proves:
- 临时独立目录中的 Node 子进程完成 help、stdin dry-run 和错误退出检查，import 只产生测试标记；非法 UTF-8 stdin 返回 input，除显式安装的依赖与预置 TS/配置外不产生隐式输出文件。
