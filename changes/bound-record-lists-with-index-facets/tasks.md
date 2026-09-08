# Tasks

任务先固定两个领域的 query facets 与列表契约，再分别实现、生成和同步说明，最后用源码、分发、性能与 test-evidence 证据闭合 Change。

## Readiness

- [x] 0.1 复核当前 Decision/Investigation index definition、reader/query result、CLI renderer、生成声明和现有 list/test-evidence Case，确认实施基线仍与本 design 一致且没有其他 active Change 占用相同 owner。
- [x] 0.2 按 Decision Records 规则建立或演进一条跨两个领域的长期决策，确认查询时聚合全局 facets、近期有界 list、`--detail` 与权威 Markdown/派生索引边界；在写入前告知用户将改变的判断和集合。
- [x] 0.3 列出两个领域将修改和新增的最小原生测试节点及既有 Case 映射，先确定哪些 Case 更新、哪些必须新增。

## Implementation

- [x] 1.1 在 Decision Records 中定义 facets 与分页结果，从同一 reader 的完整 entries 聚合 record/status/alignment/tag/UTC month/time-boundary 统计，并在领域 list query 中完成 created 时间范围、排序与分页而不改变 index definition。
- [x] 1.2 扩展 Decision list query：增加 inclusive created range、limit/offset 参数，返回 facets/total/window，并按 created instant 降序、ID 升序稳定分页。
- [x] 1.3 在 Investigation Report 中定义公开 facets，从同一 reader 的完整 entries 聚合 record/tag/UTC month/time-boundary 统计；调整 list query 返回 facets，把默认 limit 改为 10，并按 formed instant 降序、ID 升序稳定分页。
- [x] 1.4 为两个 CLI 实现有界 Index filters preview、Applied filters、Latest matches 单行 renderer、窗口 footer 与 `--detail`；让 detail 保留现有多行字段和完整 facet 目录但继续服从同一窗口，并正确处理空集合、无匹配和 offset 越界。
- [x] 1.5 同步 Decision/Investigation 的公开类型、CLI help、行为入口、固定规则/契约及适用的人类说明，明确 facets 的全局 snapshot 范围、查询时聚合、默认 10 条、时间排序、preview 上限、detail 与 show 分层，并递增两个 skill 版本。
- [x] 1.6 使用项目生成入口重建两个分发 CLI、source map 与声明；确认 Schema、definition version、Index Runtime、Investigation index 和 build adapters 保持无 diff，Decision index 只有本 Change 长期记录的规范变化。
- [x] 1.7 按 0.3 的映射更新或新增 test-evidence Case，并同步 `docs/test-evidence/test-evidence-index.json`，使每个受影响最小原生测试节点继续由明确 Case 承接。

## Verification

- [x] 2.1 用领域源码测试证明 facets 在空集合、多个 status/alignment、重复记录 tags、跨 UTC 月边界和相同时间戳场景下计数、排序、边界与重复查询稳定，并证明 list 不读取 Markdown、不改写 index。
- [x] 2.2 用 CLI/query 测试证明默认 latest 10、时间倒序与 ID tie-break、created/formed 时间范围、tag/关系组合、limit/offset 边界、offset 越界上下文、紧凑字段和 `--detail` 多行字段契约。
- [x] 2.3 用当前集合及至少 10,000 条合成 entries 验证 facets 聚合的单次线性路径、完整集合范围和有界输出；不引入不稳定的绝对耗时门槛。
- [x] 2.4 运行 `bun run test:decision-records-cli`、`bun run test:investigation-report-check`、`bun run check:decision-records-cli`、`bun run check:investigation-report-check`，证明维护源码、生成 CLI、声明与分发行为一致。
- [x] 2.5 运行 `bun run check:decisions`、`bun run check:investigations` 和 test-evidence catalog 检查，证明长期决策、现有索引与权威来源一致且测试节点映射闭合。
- [x] 2.6 运行 `bun run check`，审阅最终 diff 没有修改持久 metadata、Index Runtime、index Schema/definition version、Investigation index、搜索/候选协议、记录身份关系或其他非目标；Decision index 仅含新长期记录，并按成功标准完成语义验收。

- [x] 3.1 使用 `ai-ready-docs` 复核本 Change 直接修改的 proposal/design/tasks、两个 skill 入口、固定规则/契约、人类说明、长期 Decision 与 test-evidence Case，收敛 owner、范围、术语、显示上限和 query/renderer 边界。
- [x] 3.2 以 `docs/coding-style.md` 为主要标准审查本 Change 的全部维护源码与测试；将默认预览调整为 30 个 tags 和最近 10 个 UTC 月份，并用显式常量、独立显示选项、领域输出模块和避免排序期重复解析的数据流落实审查结果。
- [x] 3.3 重新同步两个分发产物与 test-evidence 索引，运行格式、类型、lint、两个领域测试、生成一致性、领域集合检查及 `bun run check`，再复核最终 diff 与非目标边界。
