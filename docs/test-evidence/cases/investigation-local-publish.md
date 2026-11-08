### Case INVESTIGATION-LOCAL-PUBLISH-001: 发布不要求未选正式正文健康

Tests:
- `test:3184a8685cabc846e131c44302af75558d6e6d6c833e25defd62be36e3d7272f`

Tags:
- `investigation-report`

Contract:
- 普通 publish 以发布索引为基底，不读取未选正式正文作为来源健康门禁。

Proves:
- 未选正式正文缺失、损坏、过期及 Unix 符号链接时预检与发布均成功，未引用资源保留。
