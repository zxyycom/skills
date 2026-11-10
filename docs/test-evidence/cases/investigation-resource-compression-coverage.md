### Case IR-RESOURCE-COMPRESSION-COVERAGE-001: 内部重复启发值区分下限档位与抽样

Tests:
- `test:46623df1942c9244665b848a8fd4e7839daef9d3c0680f4d3027f5e8e66cc2f5`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 默认从 64 KiB 开始计算内部重复性启发值，大小档位选择对应阈值，超过全文上限只按计划抽样。

Proves:
- 65535 字节不返回压缩观察；65536 与 262144 字节分别取 10% 和 15%；超过 1 MiB 的资源以四个 64 KiB 窗口返回 sampled、262144 输入字节和 20% 提示线。
