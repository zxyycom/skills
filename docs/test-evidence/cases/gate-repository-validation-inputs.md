### Case GATE-VALIDATION-INPUTS-001: 仓库结构校验只订阅实际布局与内容输入

Tests:
- `test:9bff3192ef1cbd78cc63cc4122458c72b54c1d5f4a7d6b7ae1f36b65116b2ec8`

Tags:
- `repository-tooling`

Contract:
- 仓库校验消费技能入口、资源布局、必需文件及校验实现，不读取嵌套运行时或无关文档字节。

Proves:
- SKILL.md 与校验实现变化重新执行 validate，搜索 renderer 源码/分发副本、无关文档与资源后代文件内容变化允许复用。
