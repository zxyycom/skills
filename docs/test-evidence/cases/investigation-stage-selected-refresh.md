### Case INVESTIGATION-STAGE-SELECTED-REFRESH-001: 选择性刷新保留未选 pending

Tests:
- `test:b301c999befa44c5cd70e0a4e49ce7766166f7d4dae91269608168a185b709c0`
- `test:d40cbc3af7eeb5d5f978a070fa491f86e9a62bcee84f78052a649183e8370a52`

Tags:
- `investigation-report`

Contract:
- stage 在指定 scope 以 worktree 完整版本替换选中对象，未选对象沿用 pending；domain 不修改索引。

Proves:
- A、B 连续暂存后再次修改并选 A，A 刷新而 B 的正文与索引投影保持；domain 替换所选部分暂存；再次相同选择无变化。
