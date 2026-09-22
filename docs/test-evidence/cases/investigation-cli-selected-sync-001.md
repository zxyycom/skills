### Case INVESTIGATION-CLI-SELECTED-SYNC-001: CLI selected sync publishes by default and keeps --preflight zero-write

Tests:
- `test:86b1668025ce56ee57fc73669d3fe39a8658fcdb3b756c841a36962f1150f052`

Tags:
- `investigation-report`

Contract:
- Investigation `sync-index --select` 默认在完整验证正式报告集合后发布当前 projection；`--preflight` 保持零写入，selector 以 ID-first 解析限制本次可接纳的来源变化。

Proves:
- 选择范围外的来源变化以领域错误拒绝且 index 保持原字节；selector 对应报告缺少来源变化时 `--preflight` 失败且零写入。
- `--write` 触发用法错误退出，stdout 为空且 index 保持原字节。
- 原始 `.md` name selector 与解析后的标准日期 ID 同时出现在结果文本；完整 projection 字节等于 full sync。
