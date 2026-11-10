### Case IR-RESOURCE-DUPLICATE-PROOF-001: 采样相等不作为完整副本证明

Tests:
- `test:f3a970332d50efaac292e989df8c5327880cb368bb49647465eccbecf6281e6f`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 不同路径完全相同的判断须有完整字节确认；抽样或预算不足不得报告为已确认副本。

Proves:
- 两个大文件只在采样外的一字节不同，有限预算只取得相同窗口；扫描入口不返回副本组，明确标记 duplicateCheck 未完成和 complete=false。
