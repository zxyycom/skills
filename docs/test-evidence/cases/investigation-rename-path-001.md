### Case INVESTIGATION-RENAME-PATH-001: 被占用 name 路径回退完整 ID basename

Tests:
- `test:48c73cfdda737660d9c70450ee786bd5dd4a562f08bd599ca18b3704a722dde3`
- `test:bfc8a2107b179a5b9d77513e890c07bc7f9c82ffabb7f10f65a2dc1ad21bb9de`

Tags:
- `investigation-report`

Contract:
- 正式报告目标名路径占用时，rename 选择完整 ID basename；两个候选路径均占用时拒绝。

Proves:
- 共享 plan_rename 的 InvestigationFormal 分支在 new.md 占用时返回 261106-new.md，两个路径都占用时返回 PathConflict。
- 独立 IR 正式 rename 真实文件测试证明该领域操作可提交并迁移正式路径；本组合不声称实际文件 fixture 运行了占用冲突。
