### Case INVESTIGATION-STAGE-SELECTED-REFRESH-001: 选择性刷新保留未选 pending

Tests:
- `test:01034930902f5ca5e64693b99976e2d0c0a5bea2549e89f7b7cea6b3ad69facf`
- `test:5f0db11e49618bec74a083e58ed70ea5d3c21641f29d2135aff3bb7250f30c9b`

Tags:
- `investigation-report`

Contract:
- stage 在指定 scope 以 worktree 完整版本替换选中对象，未选对象沿用 pending；domain 不修改索引。

Proves:
- A、B 连续暂存后再次修改并选 A，A 刷新而 B 的正文与索引投影保持；domain 替换所选部分暂存；再次相同选择无变化。
