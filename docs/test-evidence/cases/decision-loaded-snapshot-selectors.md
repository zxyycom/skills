### Case DECISION-LOADED-SNAPSHOT-SELECTORS-001: 发布快照选择器保留完整身份与名称歧义

Tests:
- `test:31264316906f2dd22939b5f1f81b75fb4ad55c79f7ef3fe06d41dfcb134f5fbb`

Tags:
- `decision-records`

Contract:
- 日期 ID 精确匹配完整 ID，末尾 `.md` 不区分大小写；名称有多个候选时报告歧义，缺失的完整日期 ID 不回退到同名对象。

Proves:
- 原生 selector 对完整 ID 加 `.MD` 精确命中；两个日期记录同名时报歧义，另一个完整日期 ID 返回 NotFound。
- 此节点不断言歧义候选的顺序或 CLI 呈现。
