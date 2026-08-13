### Case CHANGE-PLAN-METADATA-ERRORS-001: Metadata reader 映射稳定边界错误码
Entry:
- `tools/change-plan/tests/metadata.test.ts > metadata reader maps file and parse boundaries to stable error codes`
- `bun test --test-name-pattern="^metadata reader maps file and parse boundaries to stable error codes$" ./tools/change-plan/tests/run.ts`
Contract:
- Metadata reader 把文件存在性、路径类型和内容解析失败收口为稳定领域错误码；活动兼容 reader 把受支持的历史 shelf metadata 投影为 Plan。
Proves:
- 缺失文件得到 `missing`，目录占位得到 `invalid-path`，无效 JSON 与无效 stage 都得到 `invalid`。
- `source: explicit` 与历史 `source: git-distance-v1` 两种旧 shelf 形状都可兼容读取为 Plan，且不会扩大规范 parser 的写入结构。
