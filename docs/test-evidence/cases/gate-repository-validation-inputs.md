### Case GATE-VALIDATION-INPUTS-001: 仓库结构校验只订阅实际布局与内容输入

Tests:
- `test:89c41965010a3ec075c10ea449c12ce9aa0d0c556afa9591d7f5ec8f2c22d31c`

Tags:
- `repository-tooling`

Contract:
- 仓库校验消费技能入口、资源布局、必需文件及校验实现，不读取嵌套运行时或无关文档字节。

Proves:
- SKILL.md 与校验实现变化重新执行 validate，搜索 renderer 源码/分发副本、无关文档与资源后代文件内容变化允许复用。
