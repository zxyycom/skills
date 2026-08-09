# Proposal

调查报告可以按需通过本地链接引用随附资源；维护入口管理已声明的引用关系和对应资源完整性。

## Why

调查报告正文需要独立说明背景、目的、依据、结果与边界，但接口参数、原始响应、日志、截图、规范摘录或二进制样本不适合全部展开在正文中。当前格式没有受控的资源引用位置：把材料塞进正文会淹没调查主线，只写摘要又可能丢失复核所需的原始细节，把文件随意放在调查目录中则无法判断它支持哪一份报告。

本 change 首先解决“报告怎样按需引用资源”：需要保留形成时材料的报告通过固定 Markdown 元数据直接链接调查根目录中的资源，不需要资源的报告保持原样。资源关系、SHA-256、索引新鲜度和孤儿检查负责管理已经声明的引用及其文件，使读者以后仍能定位、打开和校验材料；这些支撑能力不把资源扩张为独立调查对象或制品系统。

## Outcome

资源引用是报告的可选能力。H3 报告可以完全不声明资源；需要引用时，在 `形成时间` 后声明 `随附资源`，并用本地 Markdown 链接指向调查根目录可选的 `_resources/` 资源池。

主题 Markdown 是“哪些报告声明了哪些资源引用”的事实源，资源文件是材料内容的事实源。现有 `investigation-index.json` 继续以主题为主条目，只派生已声明的报告级资源关系、集合级资源 SHA-256 摘要和覆盖资源变化的 source revision，使缺失、替换、重命名、孤儿资源和陈旧索引能够被检查发现。

## Scope

纳入：

- 定义可选的报告级 `随附资源` Markdown 语法，以及字段存在时对资源链接的条件约束。
- 定义调查根目录 `_resources/`、安全可移植的资源 ID、共享引用、孤儿拒绝和历史资源维护规则。
- 扩展调查 Markdown 解析、资源发现、路径安全、普通文件与符号链接校验。
- 在主题 state 中投影报告到资源的关系，在索引 metadata 中保存每个资源一次 SHA-256，并让资源集合与内容参与 `sourceRevision.metadata`。
- 提升调查领域 definition version，更新固定契约、JSON Schema、实现、声明、分发产物、skill 版本、测试证据和当前派生调查索引。

不纳入：

- 不改变 `<category-id>/<semantic-slug>.md` 的主题身份、报告追加模型、四项固定核心或主题级主索引粒度。
- 不建立独立资源 entry、资源全文查询、手写 manifest、资源专用生命周期或通用制品仓库。
- 不处理远程下载、内容转换、版权管理、秘密保管、大文件后端或按资源增量哈希优化。
- 不迁移当前调查正文，也不要求没有资源引用的报告创建 `_resources/`、占位字段或资源文件。
- 不在本 change 中实现 Git 暂存能力；资源集合或内容改变时允许调用方按普通文件边界暂存完整调查索引。

## Success Criteria

- 报告无需引用资源也保持合法；需要引用时可以声明 `随附资源`，且该字段中的每个链接都能从报告原文恢复资源 ID 并直接打开对应文件。
- `随附资源` 字段一旦存在就至少包含一个安全、规范且存在的本地链接，并允许同一报告声明多个资源引用。
- 默认全量检查拒绝缺失、越界、大小写不一致、符号链接、非普通文件和孤儿资源，同时允许同一资源被多份报告或主题共享。
- 每个主题仍只生成一个索引 entry；`entries[id].state` 保存报告级资源关系，`metadata.resources` 对每个被引用资源只保存一次 ID 与 SHA-256。
- 资源新增、删除、重命名或内容变化会改变 `sourceRevision.metadata`，使旧索引失效；资源相关诊断能够定位具体资源 ID。
- 报告正文仍概括影响结论的关键事实，并说明资源来源、观测条件、处理方式和支撑作用，不能用随附资源替代四项固定核心。
- 契约、实现、生成产物、当前派生索引、测试证据和主仓库检查全部通过；长期资源决策与最终事实逐项一致后才标记为 aligned。

## Affected Owners

- `skills/investigation-report/SKILL.md`：何时引用资源、正文责任、敏感信息和历史维护语义。
- `skills/investigation-report/references/investigation-report-contract.md`：资源目录、报告链接语法、索引投影、source revision 与 CLI 固定契约。
- `tools/investigation-report/`：Markdown 解析、资源发现、路径校验、哈希、索引构建、新鲜度诊断和测试源码。
- `tools/investigation-report/api/`、`skills/investigation-report/scripts/` 与索引 Schema：公共声明和自包含分发产物。
- `docs/skills/investigation-report.md` 与 `docs/investigations/investigation-index.json`：人类说明和当前调查集合的派生索引。
- `docs/decisions/investigation-report/`：主题级索引基线与随附资源长期方向。
- `docs/test-evidence/`：新增或修改测试入口对应的证据 case 与派生索引。
