### Case INVESTIGATION-RESOURCE-REFERENCE-001: 资源链接的字面路径边界

Tests:
- `test:631231617ba3f42b37e3446d8546e6d93389636e4582f4983997eee4757e4e06`

Tags:
- `investigation-report`

Contract:
- 随附资源使用安全的当前相对路径；普通文件名的成对括号合法，fragment 不属于资源路径。

Proves:
- IR body parser 接纳 evidence(1).txt 并保留资源 ID；带 fragment 或父级穿越的链接产生资源错误。
