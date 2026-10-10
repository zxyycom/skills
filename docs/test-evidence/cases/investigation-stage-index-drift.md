### Case INVESTIGATION-STAGE-INDEX-DRIFT-001: 局部暂存复核可变发布索引

Tests:
- `test:aa79eae626ce67d00f5e668a378d0b861914a9ee0b13d40794aa8934451008cb`

Tags:
- `investigation-report`

Contract:
- 固定 HEAD 复用不能取代工作区发布索引写前复核。

Proves:
- 准备读所选报告期间修改发布索引，all 暂存返回 source-drift 且 pending 不变。
