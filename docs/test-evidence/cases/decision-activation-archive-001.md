### Case DECISION-ACTIVATION-ARCHIVE-001: 发布候选建立创建身份并拒绝重复发布

Tests:
- `test:aaa870024a3e9f90e7ae3c68dde7d4f5b0fec72b19fc7943f7e2c7fb92559731`

Tags:
- `decision-records`

Contract:
- publish 只建立尚未发布的候选身份；正式记录不能再被重复发布。

Proves:
- 候选发布生成秒级 UTC createdAt 并进入正式索引，重复 publish 失败且已发布 Markdown 字节不变。
