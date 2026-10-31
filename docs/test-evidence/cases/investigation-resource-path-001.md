### Case INVESTIGATION-RESOURCE-PATH-001: attached resource section rejects unsafe local targets

Tests:
- `test:686d62aba160a23bfc55e20d78f8599edaa85e1390b359da3a1a0119b8caaeaa`

Tags:
- `investigation-report`

Contract:
- 随附资源章节只允许安全的本地资源目标。

Proves:
- Markdown 解析器对路径穿越的资源声明返回安全路径诊断，且不将其加入 resourceIds。
