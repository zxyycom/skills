### Case INVESTIGATION-STAGE-PENDING-ONLY-CANCEL-001: 撤销仅 pending 存在的新增

Tests:
- `test:d7c86bc56766b380a53f36e139c78e27b7973eff665f1796fd8f04d7a858b2a0`

Tags:
- `investigation-report`

Contract:
- domain/all 可从已变化的 pending 正式正文解析仅暂存身份；所选旧正文和 owner 资源位置以 HEAD、pending 与 worktree 的位置并集清理。

Proves:
- 新增正文与未引用 owner 附件暂存后在 worktree 撤销，再选该 ID 会移除两者；最终 pending 无差异。
