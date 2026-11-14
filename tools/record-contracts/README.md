# 记录格式机器契约

`schemas/decision-index.schema.json` 与 `schemas/investigation-index.schema.json` 是两域随包索引 JSON Schema 的纯数据维护源；生成器复制该数据，准备阶段的旧 TypeScript Schema 导出也读取同一份文件。两域 CLI 保持各自领域校验；Schema 只描述机器结构和基础约束，不能代替 Markdown、集合关系、来源一致性或生命周期检查。

资源领域的 `resource-record.schema.json` 和 `resource-index.schema.json` 分别描述记录与派生索引，领域模型及校验由 [Resource Records](../../skills/resource-records/SKILL.md) 承接；不改变原两域格式。

维护时对照相关领域规则、运行时校验及版本字段，运行对应生成检查与领域测试。格式更改应经领域 owner 裁决，不因实现行为而缩小已承诺格式；生产入口和跨平台能力分别按实际证据验收。
