# 记录格式机器契约

`schemas/decision-index.schema.json` 与 `schemas/investigation-index.schema.json` 是两域随包索引 JSON Schema 的纯数据维护源；生成器复制该数据，准备阶段的旧 TypeScript Schema 导出也读取同一份文件。两域 CLI 保持各自领域校验；Schema 只描述机器结构和基础约束，不能代替 Markdown、集合关系、来源一致性或生命周期检查。

维护时同时对照领域规则、两种运行时的校验及版本字段，运行对应生成检查与领域测试。格式更改应经领域 owner 裁决，不因 Rust 候选当前行为而缩小已承诺格式。生产入口切换和完整跨平台验收仍由对应 Change 控制。
