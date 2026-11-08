### Case INVESTIGATION-STAGE-PENDING-ONLY-CANCEL-001: 撤销仅 pending 存在的新增

Tests:
- `test:cd7ba3529a572030fbc9d4e6d7208bd3106a82bca48ef30b916a1b7272d92686`

Tags:
- `investigation-report`

Contract:
- all scope 可通过所选 canonical pending 正文定位并撤销仅 pending 存在的新增。

Proves:
- 真实 Git 中正文先新增暂存、工作区删除后以名称选择，pending 正文被移除，未选 pending 内容保持。
