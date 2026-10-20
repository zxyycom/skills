### Case SKILL-UPDATER-WRITE-ROLLBACK-001: 普通写入失败恢复文件并支持重试

Tests:
- `test:df55c0f20a7f5e700014b890081431bcf16105223ad3e709ca22842be3876857`

Tags:
- `skill-updater`

Contract:
- 普通更新写入失败会尝试恢复本次替换并移除本次新增，其他文件不变；不承诺进程终止或崩溃后的事务恢复。

Proves:
- 在暂存副本应用阶段注入 copy 失败后原 SKILL.md 被恢复、新增文件被移除且定制未变；解除故障后的同一安装成功。
