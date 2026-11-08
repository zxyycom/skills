# 决策记录工具维护

普通查询和维护从 [Skill](../../skills/decision-records/SKILL.md) 进入；该目录不再提供领域 TypeScript 业务 CLI 或 SDK。业务实现与测试由 [Record CLI](../record-cli/README.md) 维护，机器 JSON 与失败边界见[原生协议](../record-cli/protocol.md)，共同职责见[记录操作模型](../record-operations/model.md)。

领域语义、读取策略及操作约束由该 skill 和其 references 承接；索引 Schema 纯数据源由 `tools/record-contracts/schemas/` 承接。修改公开行为时同步领域文档并按独立 skill 版本规则交付；验证以实际平台、命令和修订为准，不以本地构建代替安装或发布验收。
