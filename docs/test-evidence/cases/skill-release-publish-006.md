### Case SKILL-RELEASE-PUBLISH-006: 滚动发布跳过已同步资产

Tests:
- `test:5f219882a0163762f1121430eb49e460a370629c51a21f741214ee65297d5058`

Tags:
- `repository-tooling`

Contract:
- 成功构建进入滚动发布核对后，只有当前完整制品与远端资产不一致才执行远端写入。

Proves:
- 远端完整资产的名称、大小和 SHA-256 digest 与当前制品一致时，CLI 报告无变化并返回零。
- 无变化分支只读取 Release，不移动 tag、不推送，也不上传或编辑资产。
