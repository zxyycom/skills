### Case INVESTIGATION-RESOURCE-PATH-001: attached resource section rejects unsafe local targets

Tests:
- `test:31d9bb6858273c735a2565a2706d08840de4d25d9575a06b367a96dd36404a66`

Tags:
- `investigation-report`

Contract:
- 随附资源章节只允许安全的本地资源目标。

Proves:
- Markdown 解析器对路径穿越的资源声明返回安全路径诊断，且不将其加入 resourceIds。
