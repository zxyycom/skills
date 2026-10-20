### Case INVESTIGATION-RESOURCE-MEMBERSHIP-001: resource resources are never projected as index source bytes

Tests:
- `test:9b862ef0148b0d0028f29eaed7ca4b5c9c537fb7cf527f5d7b877959a85ebd75`

Tags:
- `investigation-report`

Contract:
- 报告索引 state 不投影资源字节。

Proves:
- 真实 Markdown 解析与 state 构建保留 resourceIds，但内存领域 state 不含 `resourceBytes`；不执行索引持久化。
