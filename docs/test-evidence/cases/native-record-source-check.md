### Case NATIVE-RECORD-SOURCE-CHECK-001: 逐源体检报告成功和局部失败

Tests:
- `test:e4e24e7dd00c50acb33ca0d76b02342e931cf1dc5c253a865bf1782cc18dcd77`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 按 key 的 check 分别体检来源，全部健康时成功；一源失败仍保留另一源的体检结果和失败诊断。

Proves:
- 两源真实合法报告分别同步索引后，check 退出 0，每源 formalCount 为 1 且 indexState 为 current。
- 破坏第一源报告后 check 退出 1、汇总 source-query-failed，第一源带非空诊断，第二源仍成功且索引 current。
