# Proposal

本 Change 为 Decision Records 与 Investigation Report 的关系边增加可选短摘要，并作为要求两个领域同步交付的 Plan，而非任一领域的先行试点。

## Why

现有关系类型和目标只能说明两条记录在图中的结构联系。阅读者若要恢复这条边为何存在，通常必须展开完整记录；同时，把摘要塞入关系类型、目标、ID 或排序规则会破坏既有图语义和稳定身份。

## Outcome

Decision 与 Investigation 的每条直接关系都可以保留一个可选短摘要，并在 Markdown、领域 API、索引和图/trace 输出中稳定呈现；旧关系和未填写摘要的新关系保持有效，摘要不改变边身份、图验证或关系排序。

## Scope

### Intended Change

- 为 Decision 与 Investigation 的 relation 持久化、内存模型、公开 API 和索引 relation projection 同步增加可选 `summary`。
- 两领域对输入采用同一值契约：先 trim；纯空白规范化为省略；保留值必须为单行且最多 40 个 Unicode 码点；多行或超长均为错误，绝不截断。既有无摘要 relation 输入和 Markdown 继续合法。
- 两领域 CLI 保留重复 `--relation <type=target-selector>`，并新增重复 `--relation-summary <target-selector=summary>`；后者不是单边 patch，只能绑定到同次命令完整 relation set 中唯一已有的 target。它只按第一个 `=` 分隔，其余 `=` 属于 summary；target 按领域既有 ID-first/name selector 解析，程序化 API 直接使用 `{ type, target, summary? }`。各既有 relation 命令的完整替换、保留、排斥与 Investigation source group 绑定矩阵由 design 固定；`show`、关系图、`trace` 与领域 API 显示已存在的摘要。
- 让 `sync-index`、Schema、source revision 和生成制品投影或验证摘要；rename 改写关系 target 时必须保留摘要。为两个领域更新行为说明、测试和 Test Evidence。

### Resulting Impacts

- `summary` 只是边说明，不能参与 relation type/target 的身份、去重、规范排序、时间方向、关系形状、直接前序判断或环检测；相同 type/target 的关系仍不能因摘要不同而共存。
- 新旧 Markdown、candidate 与正式记录均可省略摘要，不强制回填或批量迁移。空白输入在规范化后等价于省略，不能形成另一种持久表示。
- 索引 relation projection 可以提供摘要给 metadata search；`add-index-only-metadata-search` 独自拥有是否搜索该字段、字段白名单、`--in` 选项、匹配模式和 fallback 细则。本 Change 不修改这些搜索契约，也不以该 Change 完成为实施前提。
- 两领域必须在同一 Change 内同步接入 Markdown、关系图、API、trace、索引、rename 与兼容证据；不能以一个领域先发布、另一个领域后补的试点方式交付。

## Success Criteria

- Decision 与 Investigation 均可在新 relation 上保存、读取并显示可选 `summary`；历史无摘要关系、候选和正式关系无需迁移且保持合法。
- 两领域都对纯空白省略、trim 后的单行值、40 个 Unicode 码点边界、多行输入和超长拒绝给出一致证据；超长值从不被截断后保存。
- 两领域 CLI help 与 design 的命令级绑定矩阵均有 CLI/API 证据：首个 `=` 分隔、ID-first/name target 解析、完整 set 唯一 target、summary-only/clear 排斥、缺省 summary 的保留或清除语义，以及 Investigation source group 归属；程序化 API 不采用 CLI 编码而直接接收 `{ type, target, summary? }`。
- 关系图、`trace`、领域 API 和索引 relation projection 显示摘要；摘要不改变 type/target 去重、排序、时间方向、关系形状或无环校验结果。
- Decision 与 Investigation 的 rename 均在改写 relation target 后保留摘要；无摘要与有摘要关系的同步、读取和生成 Schema 都通过兼容验证。
- metadata search 没有被本 Change 改写；其现有/后续实现能够从索引 relation projection 获取摘要的边界由 `add-index-only-metadata-search` 继续拥有。
- 受影响领域测试、生成制品和 Test Evidence 检查，以及 `bun run check` 通过。

## Affected Owners

- `tools/decision-records/`、`skills/decision-records/` 与 `scripts/build/decision-records.ts`：Decision relation 模型、CLI/API、图/trace、索引、rename、分发制品与行为入口。
- `tools/investigation-report/`、`skills/investigation-report/` 与 `scripts/build/investigation-report.ts`：Investigation relation 模型、CLI/API、图/trace、索引、rename、分发制品与行为入口。
- `tools/shared/`：只在两领域确有共同 relation graph/API 契约时承接摘要透传；不建立新的统一领域 relation 命令。
- `docs/test-evidence/decision-records/`、`docs/test-evidence/investigation-report/` 及其派生索引：承接受影响最小原生测试入口的可检索证据。
- `changes/add-index-only-metadata-search/`：metadata search 的字段使用与查询语义 owner；本 Change 只保持其可消费的索引边界。
