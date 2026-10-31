### Case INVESTIGATION-CLI-SELECTED-SYNC-001: CLI selected sync publishes by default and keeps --preflight zero-write

Tests:
- `test:91ad5d7686de762058bbaefab626f503e3d44cbef1630a317bb1db34eac3697b`

Tags:
- `investigation-report`

Contract:
- Investigation `sync-index --select` 默认在合法发布基线上验证所选已知路径与必要依赖，发布完整组合 projection；未读来源当前性不检查，`--preflight` 同范围零写入。

Proves:
- 无关未选来源变化不阻断局部同步，index 保持原字节且结果明确未选条目沿用发布基线；合法所选来源变化的 `--preflight` 成功、明确尚未发布且 index 保持原字节。
- `--write` 触发用法错误退出，stdout 为空且 index 保持原字节。
- 原始 `.md` name selector 与解析后的标准日期 ID 同时出现在结果文本；完整 projection 字节等于 full sync。
