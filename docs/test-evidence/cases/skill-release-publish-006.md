### Case SKILL-RELEASE-PUBLISH-006: 滚动发布跳过已同步资产

Tests:
- `test:d8e862050e52815e215d8c54fe19775e1ae6cf86fbf1d002e1b06ff875ebcda4`

Tags:
- `repository-tooling`

Contract:
- 成功构建进入滚动发布核对后，只有当前完整制品与远端资产不一致才执行远端写入。

Proves:
- 远端完整资产的名称、大小和 SHA-256 digest 与当前制品一致时，CLI 报告无变化并返回零。
- 无变化分支只读取 Release，不移动 tag、不推送，也不上传或编辑资产。
