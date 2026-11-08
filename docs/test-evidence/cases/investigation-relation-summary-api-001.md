### Case INVESTIGATION-RELATION-SUMMARY-API-001: 调查关系摘要归一化与边界

Tests:
- `test:4b49b17d8ebeea567b62546d7357fafd7321715165579f84653b101861dbe134`
- `test:9d2f1b4a01893e829832bf167dcc05efe07e0d68e9ef08fbcae09e3e758b48c7`
- `test:f92111b2396839c984f7972b88beab3d7386960a8292ca418ba33c2e7f31403f`

Tags:
- `investigation-report`

Contract:
- 调查关系摘要归一化去除边缘空白，空摘要省略，非空摘要为单行且最多 40 个 Unicode 码点。

Proves:
- 关系归一化保留裁剪后的摘要并省略纯空白摘要；JS 空白字符也被裁剪。
- 边缘换行和空白先 trim，纯空摘要省略；内部换行与 41 个码点被拒绝，40 个非 BMP 码点裁剪后保留。
- 真实 CLI 以 40 个非 BMP 字符创建候选并保留摘要；41 个时返回失败且不创建候选。
