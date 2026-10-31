### Case STATE-INDEX-FULL-READ-CLASSIFICATION-001: 完整索引采集保留机械错误类别

Tests:
- `test:19ea9b0c1f2d4fa4411e88ef6d27801de96f7848b7709ed2601e565286797378`

Tags:
- `index-runtime`

Contract:
- 缺失、坏JSON、坏UTF-8与I/O分别按原有check／preview类别处理。

Proves:
- 合法missing可preview，badJSON／UTF8严格check失败，one-shot EACCES只读一次并保留access-denied。
