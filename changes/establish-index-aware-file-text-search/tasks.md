# Tasks

任务先固定共享协议与同快照索引协作边界，再接入两个领域并以生成物、契约和端到端搜索验证结束。

## Readiness
- [ ] 0.1 审计 `tools/shared/src/file-text-search/` 的现有共享模块约定、glob/UTF-8/path 边界和三个 skill 的 build 链，确认实现由领域 bundle 内联且不创建独立 CLI、README 或分发目标。
- [ ] 0.2 为共享模块写出可执行输入/输出类型与 fixture 矩阵：patterns/files 互斥、领域 root 安全、root-relative sourcePath、all/any 跨行、phrase 单行、NFKC/大小写/空白、原文坐标、预览窗口、顺序与各类限制。
- [ ] 0.3 审计 Decision 和 Investigation 的真实集合 root、state.sourcePath、archive/candidate/resource/index 排除、current-index/fallback 路径及现有 CLI selector/分页规则，确定同一 snapshot entries Map 与文件列表断言。
- [ ] 0.4 审阅 `use-fixed-index-query-modes` 与 Test Evidence 实际 text consumers，记录本 Change 只退出 Investigation text key、并把通用 text mode 删除留给后继 Change 的边界。

## Implementation
- [ ] 1.1 在 `tools/shared/src/file-text-search/` 实现并测试共享模块：root 内 pattern 或显式 files 选择、普通文件/UTF-8/符号链接边界、规范 root-relative 路径、确定遍历和有界资源限制；确认领域 build 内联它。
- [ ] 1.2 实现并测试 all/any 可跨行、phrase 仅单行的 NFKC/大小写/空白匹配，以及从规范化匹配到原始行列和可合并 rg 风格预览的映射。
- [ ] 1.3 为 Decision 建立当前 index snapshot entries 的 index-first 显式 file list、唯一 sourcePath Map 与完整验证 fallback，接入 `search`、领域摘要和 active 默认范围；覆盖 archive、非 ID basename、结构筛选、映射错误和索引陈旧 warning。
- [ ] 1.4 为 Investigation 建立等价 adapter 与 `search`，以正式索引 entries 明确排除 candidates/resources/index，接入 tag/date/relation 筛选、摘要和 fallback；删除 `list --text`、text key/text projection，并升级领域 definition/index Schema。
- [ ] 1.5 更新 Decision/Investigation 的 CLI help、skill 默认读取流程、固定契约、维护恢复说明和必要长期决策，使 `search → ID → show/trace` 成为未知主题的正式路径。
- [ ] 1.6 依照现有 build owner 重建受影响 skill bundle、source map、声明和 JSON Schema，并更新 Decision/Investigation/共享模块测试证据 case 与派生索引。

## Verification
- [ ] 2.1 运行共享文件搜索模块的单元/fixture 测试，证明安全边界、root-relative 路径、pattern/files 等价性、三种模式的行语义、Unicode 原文定位、预览合并、排序和限额。
- [ ] 2.2 运行 Decision Records 测试与 CLI 端到端样例：正文独有词、all/any/phrase、同一索引快照的结构预筛选/文件列表/Map、完整 ID、sourcePath 和 fallback/失败语义均正确。
- [ ] 2.3 运行 Investigation Report 测试与 CLI 端到端样例：正文独有词、candidate/resource/index 排除、结构预筛选、旧 `--text` 拒绝、完整 ID 与 preview 均正确。
- [ ] 2.4 验证所有受影响 JSON Schema、生成物和 skill build 检查当前，并确认 Index Runtime/Test Evidence text consumer 在本阶段仍通过既有测试。
- [ ] 2.5 运行 `bun run check`，人工审阅新长期决策、skill 指引与搜索输出不会把未映射或截断结果表述为完整。
