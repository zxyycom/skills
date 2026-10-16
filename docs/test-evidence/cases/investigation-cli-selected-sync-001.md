### Case INVESTIGATION-CLI-SELECTED-SYNC-001: CLI selected sync publishes by default and keeps --preflight zero-write

Tests:
- `test:06267a316e544644393723e47b8d092e0e978b5ff78bec8ab51e5852c8d98352`

Tags:
- `investigation-report`

Contract:
- Investigation `sync-index --select` 默认在完整验证正式报告集合后发布当前 projection；`--preflight` 保持零写入，selector 以 ID-first 解析限制本次可接纳的来源变化。

Proves:
- 选择范围外的来源变化以领域错误拒绝且 index 保持原字节；合法所选来源变化的 `--preflight` 成功、明确尚未发布且 index 保持原字节。
- `--write` 触发用法错误退出，stdout 为空且 index 保持原字节。
- 原始 `.md` name selector 与解析后的标准日期 ID 同时出现在结果文本；完整 projection 字节等于 full sync。
