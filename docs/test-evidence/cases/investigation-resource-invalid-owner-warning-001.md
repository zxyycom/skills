### Case INVESTIGATION-RESOURCE-INVALID-OWNER-WARNING-001: 可见未引用异常路径给出可定位 warning

Tests:
- `test:9fce3c04922a6c38202fdeb907eae7cc944be4d67bb9a8f16ef09aea075289c4`

Tags:
- `investigation-report`

Contract:
- 未引用的可见异常资源路径应提供可定位的 warning。

Proves:
- 非 Git 资源树中 `_resources/..bad/file` 产生包含 `..bad/file` 的 unreferenced visible resource warning；不声称 warning 分类为 unsafe。
