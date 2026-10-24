### Case DECISION-ACTIVATION-ARCHIVE-001: 发布候选建立创建身份并拒绝重复发布

Tests:
- `test:907fd9549d02fab81ad4aa0b37c827ffb13eecce302ae02cbe0a61f3e9c1c774`

Tags:
- `decision-records`

Contract:
- publish 只建立尚未发布的候选身份；正式记录不能再被重复发布。

Proves:
- 候选发布生成秒级 UTC createdAt 并进入正式索引，重复 publish 失败且已发布 Markdown 字节不变。
