### Case STATE-INDEX-FULL-READ-CLASSIFICATION-001: 完整索引采集保留机械错误类别

Tests:
- `test:c06445d1a68929139af19a0704adb8d57d8fcb9ad47212ced0063498503ed4dd`

Tags:
- `index-runtime`

Contract:
- 缺失、坏JSON、坏UTF-8与I/O分别按原有check／preview类别处理。

Proves:
- 合法missing可preview，badJSON／UTF8严格check失败，one-shot EACCES只读一次并保留access-denied。
