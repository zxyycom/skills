### Case INVESTIGATION-LAZY-SELECTOR-001: 缺失与歧义选择器在构图前返回诊断

Tests:
- `test:a229dda3f3f5f23b67341c2bb2a6148f4594d4c2d5cf3f80ead1d47c3d63b0d4`

Tags:
- `investigation-report`

Contract:
- 未知或歧义 selector 必须保留原错误语义，并在图构建之前失败。

Proves:
- 关系筛选与完整 trace 投影入口对缺失或歧义名称给出一致错误，原始 relations 图投影次数保持为零。
