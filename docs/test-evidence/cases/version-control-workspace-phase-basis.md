### Case VERSION-CONTROL-WORKSPACE-PHASE-BASIS-001: 显式阶段依据不削弱默认表示新鲜度

Tests:
- `test:15d8870e3b69a3479d57cfa8deeef70e5b8da5befcabf76dd5edb459fe5738c9`

Tags:
- `version-control`

Contract:
- 批量工作区读取可复用调用方提供的完整阶段 pending 快照；未提供时仍读取新的表示依据。

Proves:
- 显式依据只有一次 config、零额外 ls-files；pending 模式变化后默认读取新模式，而显式依据按其内容解释，缺失按 regular；重复或 symlink 所选依据拒绝且不写 pending。
