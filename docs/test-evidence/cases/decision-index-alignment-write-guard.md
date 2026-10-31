### Case DECISION-INDEX-ALIGNMENT-WRITE-GUARD-001: 非法对齐值不能进入索引

Tests:
- `test:c0f2dfe73273abfef5a5820abe6a6b160bcc74f6461bdb6144311f873bf0e8c8`

Tags:
- `decision-records`

Contract:
- 非法对齐值不能进入索引。

Proves:
- alignment:null 使 check 与 sync-index 失败并定位来源/字段，Markdown 与索引字节不变。
