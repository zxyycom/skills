### Case NATIVE-RECORD-GIT-STAGE-COMPOSE-001: 选择性 stage 投影组合

Tests:
- `test:f33c933c17e5acde3da6af37c9c3527783cd4d574dad9ba15d7bc4d4d59a9150`
- `test:f4ff48ad89f95e41a332cbdf37d6245e3d75a6dbf722c0374c8706a6796fb3ee`

Tags:
- `record-rust`

Contract:
- stage 投影必须保留未选择 pending，且拒绝基线变化。

Proves:
- 固定 HEAD、pending 和选定项验证新增、删除与冲突投影。
