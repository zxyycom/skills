### Case DECISION-NEW-CLEANUP-ONLY-001: 候选创建清理失败保留准确结果与残留路径

Tests:
- `test:386e7d134fb6b614d4f514194579f7ff359d2ae0dfea4733dce0f53e1bc98490`

Tags:
- `decision-records`

Contract:
- 候选 create 已发布且字节验收通过后，只有私有临时文件清理失败时应报告 committed-cleanup-pending，保留真实 ID/sourcePath 和精确清理位置，不输出成功 readiness。

Proves:
- 注入私有 staging unlink 失败后 CLI 非零、保留已创建 scaffold 路径并精确列出 docs 下残留，且不打印 scaffoldValid/bodyReady。
- 实际候选正文与原正式 index 保留，不把清理失败降成未创建或完整回滚。
