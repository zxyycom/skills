### Case INVESTIGATION-RESOURCE-INVALID-OWNER-WARNING-001: visible resource discovery rejects unsafe owner directory names

Tests:
- `test:b0b37631840b69a839f604a056dfbe6918d4e5c24be5050a4a2f9546b7f09777`

Tags:
- `investigation-report`

Contract:
- 可见资源发现拒绝不安全的 owner 目录名。

Proves:
- 真实资源树中不安全的 ..bad owner 目录产生同时标识该名字与安全原因的 warning。
