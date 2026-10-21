### Case GATE-UNCLOSED-INPUT-DIAGNOSTICS-001: CLI 定位未闭合输入但不改变执行与证明语义

Tests:
- `test:c29f4b34cdf30b5f22085aecfaf688556ad6e23d471b35f08b49963924173dce`

Tags:
- `repository-tooling`

Contract:
- 已采集快照的未闭合输入保留 incremental 计划与保守执行；终端和增量 machine 摘要提供相对路径及稳定原因，不将其混同采集失败。

Proves:
- CLI 对未归领域能力、未知输入、符号链接与不支持文件类型分别公开路径和原因，machine 保留真实总数、执行计数及 inputs-unclosed 发布结果。
- 运行参数保持计划的工具 flag，成功 Gate 仍退出 0，未闭合输入不创建成功 receipt，终端不伪报 Snapshot fallback。
