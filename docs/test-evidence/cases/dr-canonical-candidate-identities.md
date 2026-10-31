### Case DR-CANONICAL-CANDIDATE-IDENTITIES-001: 完整日期身份的新建与局部候选定位

Tests:
- `test:0c2d244fca23ed4b53407a69a5b0ea74bb4c786f790825b9dc51acfa1c0b24ba`
- `test:be86b737d509fbf6a3f45fffd8fce521074d6cb80b8427b5dda6e8c725ec6a70`
- `test:c3567b09c28d940aca0633d0f662937917cb45dc15f0c9b51a1e926aa6c70920`

Tags:
- `decision-records`

Contract:
- 新建使用 YYMMDD-name 的完整 basename，允许 legacy/跨日同名；完整 ID 冲突不覆盖，转正保留 ID 和实际 sourcePath。
- 精确 canonical 候选只读取所选正文，正式依赖使用发布索引；legacy 名称歧义不等于旧文件迁移。

Proves:
- 同名 legacy、跨日候选与当日候选共存；重复新建失败且已有字节不变，name 查询歧义而完整 ID 成功；publish 后索引保存创建时相同 ID/path。
- legacy 与日期对象同名时，按 name 查询明确歧义；授权下精确更名日期候选到不同 name 后，legacy 可再次唯一选择，原文件字节保持。
- 给未选候选和正式依赖的 open 设置拒绝探针后，精确候选读取与 publish 均成功，探针零触发，所选确实转正且未选坏内容保持。
