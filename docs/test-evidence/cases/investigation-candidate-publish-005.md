### Case INVESTIGATION-CANDIDATE-PUBLISH-005: 发布前重新核对所选候选与索引

Tests:
- `test:4223618bbc7567a2aff44d418b6dcab3a95859c95daf582e141fc6905168145c`
- `test:c08596a8d6601d5cdc8ef598992b78326b0d42406a33ff40fe777a2a5ea10703`

Tags:
- `investigation-report`

Contract:
- 普通 publish 在提交前重新验证所选候选与当前索引；这些受保护事实漂移时不发布。

Proves:
- 分别修改 selected candidate 与索引，publish 拒绝且不执行写入器，候选保持在 authoring workspace。
