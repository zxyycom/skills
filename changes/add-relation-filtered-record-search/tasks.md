# Tasks

本清单按“领域查询契约 → Decision 实现 → Investigation 实现 → owner 与分发 → 聚焦证据”的顺序推进。完成出口是两个领域都能把直接关系条件与现有结构条件、content search 和 metadata search 正确组合，且无需依赖本次对话恢复产品判断。

## Readiness

- [x] 0.1 审计 proposal、design 与用户已确认方向：范围只包含一个领域内目标、直接 `predecessors`/`successors`/`both`、单个可选 relation type、同边关联，以及与现有结构条件和文本搜索的交集；不建立通用多条件协议或跨 skill 入口。
- [x] 0.2 核对 Decision 与 Investigation 的实际 owner、selector、关系方向、index state、list/search 查询顺序、content fallback、metadata segment、CLI、公开声明、生成链和 skill version；确认现有 state 已包含完成查询所需的直接关系。
- [x] 0.3 核对长期决策与迁移边界：本 Change 直接落实已对齐的 `260905-search-authoritative-files-with-index-identity`，不需要新的长期取舍；Index Runtime、索引 schema、definition version、历史记录和关系摘要均无需迁移或回填。
- [x] 0.4 核对兼容与错误边界：目标按标准 ID 优先、唯一 name 回退规则解析，方向相对目标解释，无目标 direction 失败，目标与类型共同出现时匹配同一条边，关系筛选发生在排序和分页之前，合法无匹配返回空集合。
- [x] 0.5 检查当前 Git 状态与目标路径，确认本 Change 之外没有未归属改动，受影响 owner 没有工作区重叠修改，design 没有需要用户决策的 Open Questions。

## Implementation

- [ ] 1.1 在 Decision 查询类型、CLI 参数和帮助中加入 `relatedTo`、`direction` 与 `relationType`，复用领域 selector、trace direction 和 relation type 校验；无目标 direction 作为参数错误，不改变无关系条件请求。
- [ ] 1.2 在 Decision 查询服务中从对应 list、content 或 metadata snapshot 解析目标并计算直接关系 ID，以同边谓词组合可选 type，再与 status、alignment 和重复 tag 的 AND 条件共同筛选；保持 fallback、排序、`fullTime`、DTO、warning 和 metadata 命中证据语义。
- [ ] 1.3 在 Investigation options、公开类型、CLI 参数和帮助中加入 `relatedTo` 与 `direction`，复用现有 `relationType`；保持 list 的 offset/limit/total 和 search 的 limit 契约。
- [ ] 1.4 在 Investigation list、content search 和 metadata search 中从各自 snapshot 解析目标并计算直接关系 ID；目标存在时用同边谓词生成 `id` filter，目标不存在时保留既有 relation-type field，并保证结构筛选先于排序、分页和文本匹配。
- [ ] 1.5 更新两个 `SKILL.md`、领域规则或固定契约及必要的人类说明，使查询入口、方向、同边约束、fallback 与 metadata 证据边界和实现一致；分别提升 skill metadata version。
- [ ] 1.6 通过现有 build 入口同步 Decision bundle/source map/SDK declarations 与 Investigation bundle/declaration；只有生成闭包不能覆盖新导出时才修改 build script，且不改变索引 JSON Schema 或 definition version。
- [ ] 1.7 为每个新增或修改的最小原生测试入口维护唯一 test-evidence case，并同步统一派生索引；测试只覆盖本 Change 的可观察契约，不增设与验收无关的辅助抽象或重复入口。

## Verification

- [ ] 2.1 用 Decision 聚焦测试证明 API 与 CLI 的 selector、三种方向、默认 `both`、独立 type、target/type 同边、重复 tag/status/alignment 交集、空结果、非法输入、content 文件范围、fallback snapshot 和 metadata 证据语义。
- [ ] 2.2 用 Investigation 聚焦测试证明 API 与 CLI 的 selector、三种方向、默认 `both`、独立 type 兼容、target/type 同边、重复 tag/formedAt 交集、空结果、非法输入、list offset/limit/total、content 文件范围、fallback snapshot 和 metadata 证据语义。
- [ ] 2.3 运行 `bun run test:decision-records-cli`、`bun run test:investigation-report-check`、两个生成制品 check 及两个 skill 的结构验证，确认源码、公开声明、分发 bundle、帮助和行为 owner 一致。
- [ ] 2.4 运行 test-evidence 同步与检查，确认新增或修改的每个最小原生测试入口都有唯一 case，派生索引无漂移。
- [ ] 2.5 运行 `bun run check` 并审阅最终 diff，确认无关系条件请求保持兼容，没有修改 Index Runtime、索引 schema/definition version、持久 state 或长期决策，也没有引入跨领域查询抽象、反向索引、多跳或查询 DSL。
- [ ] 2.6 仅依据三个 Change artifacts 与其中引用的稳定 owner 做实施阅读复核：实施者能够恢复输入、方向、同边谓词、snapshot、组合顺序、错误、兼容、分发和证据边界，无需从对话补充决定。
