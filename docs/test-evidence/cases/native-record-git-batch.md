### Case NATIVE-RECORD-GIT-BATCH-001: Git 批量选择与预算回退

Tests:
- `test:02ce427177f387af338addd74ccd6c22b5217055506e3c2915d4a2584530168c`
- `test:1e3a8a203eecb4b21babb4fd2ebcd97047dc96b7712a6d182c6d11e4c9580310`
- `test:22851be9c54d65d7a9c3435330b024755bc69504776d61fae883c509c6e01b57`

Tags:
- `record-rust`

Contract:
- 批量读取固定历史和 pending 只接受所选对象与 literal 路径，预算不足时仍保持读取结果。

Proves:
- 私有 Git 仓库核对重复对象、路径及损坏对象边界；SHA-256 内容和受限输出预算下的 blob 与路径逐项回退保持预期。
