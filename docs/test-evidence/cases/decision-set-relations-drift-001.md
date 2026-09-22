### Case DECISION-SET-RELATIONS-DRIFT-001: set-relations 拒绝写前来源漂移并支持重扫后重试

Tests:
- `test:814ea65570354e72dce3e42288626cb4c59ea21e259715921842cba83bac01d7`
- `test:a3c04488804cd886cf4fe3af9441651263a3820a973257949aa5a218c9324c74`

Tags:
- `decision-records`

Contract:
- `set-relations` 复用的决策文件事务在写入前核对来源字节与索引；漂移以 no-change 拒绝。

Proves:
- 准备后的来源字节被并发修改时事务以 no-change 失败，来源与索引保持漂移后的字节。
- 重新扫描后同一 CLI 命令成功写入替换关系。
