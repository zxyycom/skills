### Case TEST-EVIDENCE-PROJECT-AST-GREP-BATCH-001: 项目快照批量扫描测试定义

Tests:
- `test:6de8158ef39a4c93d3d3e373b9d83b20eb7f38bf1328aa72ca3250a78c9bbc80`

Tags:
- `repository-tooling`

Contract:
- 同一参数预算批次内的测试闭包文件必须由一次包含七项固定规则的 ast-grep scan 调用共同扫描；批量结果仍按来源文件归属静态测试定义。

Proves:
- 两个测试文件共同出现在一次包含七项固定规则的 scan 调用中，快照仍分别形成两个注册实体。
