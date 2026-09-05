# Design

本设计将 relation summary 定义为与 type、target 并列、但不参与边语义的可选说明字段；Decision 与 Investigation 必须在同一 Change 内交付这一核心契约。

## Context

Decision 与 Investigation 都从后继记录指向直接前序，以 relation type 和目标 ID 构成图边；两领域各自维护 Markdown 解析、candidate/正式关系事务、图验证、索引投影、rename、show 与 trace。当前 relation identity、去重、排序、时间方向、形状和无环验证都基于既有 type/target 与图规则，不能由阅读性文本改变。

`add-index-only-metadata-search` 已拥有 metadata 搜索范围、字段选择、匹配和 fallback 的长期计划。relation summary 需要进入领域索引 projection，才能成为该 Change 可选择的元数据；但本 Change 不向任何 `search` 命令增加或修改行为。

## Goals / Non-Goals

目标：在两个领域同步保留、验证、投影和显示可选短摘要；使摘要对人类读边、API consumer 和 trace 可见；让无摘要的历史关系完全兼容。

非目标：新增关系类型、边 ID、关系排序键、关系图算法、自动生成摘要、摘要全文/metadata 搜索、摘要迁移任务、任一领域先行试点，或把摘要纳入当前结论、授权、状态、优先级或资源语义。

## Decisions

### Intended Change

1. **规范值。** relation 对象增加可选 `summary`。输入先 trim；若结果为空，规范化为字段省略。非空值不得含物理换行，按 Unicode 码点计数不得超过 40；违反单行或长度限制时失败，绝不截断、折行或以空白替换。写出时只保留已规范化的非空值。
2. **边不变量。** `summary` 不属于边身份。两个领域继续以既有 type/target 规则判断重复、排序、时间方向、关系形状和环；同一 source 中相同 type/target 即使摘要不同仍是重复。图算法接收并返回摘要以供显示，但不得以它作为比较或拓扑输入。
3. **统一 CLI 与 API 表面。** 两领域保留重复 `--relation <type=target-selector>`，新增重复 `--relation-summary <target-selector=summary>`。后者不是单边 patch：每个 summary 必须在其命令当前完整 relation set 中恰好命中一个 target，同一 target 最多一次；未命中、重复或 summary-only 均失败。summary 参数只按第一个 `=` 分隔，后续 `=` 是 summary 内容；左侧 target 一律用领域既有 ID-first/name selector 收敛。程序化 API 不复用 CLI 编码，直接接收 `{ type, target, summary? }`。旧的无摘要参数、Markdown、candidate 与正式报告保持原语义。
4. **命令级绑定矩阵。** 以下矩阵是各入口保留、替换、清除和拒绝 summary 的唯一规则；未列入口不获得摘要写入路径。
   - **Decision `new`：** 一个隐式 source group。summary 必须与同次至少一个 `--relation` 同时出现，并唯一绑定该次完整 relation set；summary-only 无效。`new` 不提供 `--clear-relations`，因此也不能以 clear 形式携带 summary。
   - **Decision `activate` 新 candidate：** 未传 relation 或 summary 时，保留 candidate source 的完整 relation 与 summary；传入 `--relation` 时，沿用现有完整统一替换，并让 summary 只绑定该替换 set，未提供 summary 的边写为省略。summary-only 与 `--clear-relations` 加 summary 均拒绝。重新激活 archived 记录继续沿用现状，拒绝任何 relation 或 summary override。
   - **Decision `evolve`：** 未传 relation 或 summary 时，每个 successor 保留自身 source relation 与 summary；传入 `--relation` 时，沿用现有“同一个完整 set 应用于所有 successor”，并把同一摘要 override 明确复制给每个 successor。summary-only 与 `--clear-relations` 加 summary 均拒绝。需要不同 successor 摘要时，先写入各 candidate source，再省略统一 override；本 Change 不为 established 多 successor 增加 patch surface。
   - **Investigation `new`：** 一个隐式 source group，遵循 Decision `new` 的 relation/summary 同现、完整 set 唯一绑定和 summary-only 拒绝规则；该入口没有 clear 形式。
   - **Investigation `set-relations`：** summary 归最近 `--source` group，可在该 group 内任意顺序出现，并在下一个 `--source` 或命令结束时按解析后的 target 绑定该 group 的完整 relation set。summary 必须同时有 relation；summary-only、`--clear-relations` 加 summary、未命中 target 和重复 target 都拒绝。未提供某 relation 的 summary 即在该完整替换中省略并清除旧摘要。
5. **已建立关系的维护。** 已建立 Decision 或 Investigation 若要新增、删除或替换摘要，必须通过上表适用的既有完整 relation replacement 入口重新提交完整 set；不新增按已建立 relation 单边 patch 的命令、selector 或 API。
6. **读取、投影与 rename。** Markdown parser/renderer、领域 API、show、关系图和 trace 都保留并显示存在的摘要。每领域 index state 的 relation projection 与 Schema 带该可选字段，source revision 因 Markdown 变化自然更新；`sync-index` 读取无摘要旧来源时不制造字段。rename 只更新 target 身份或相关定位，必须逐字保留 relation summary。
7. **搜索边界。** index relation projection 只提供可选 summary；`add-index-only-metadata-search` 独自决定 metadata search 是否匹配它及其字段/结果语义。本 Change 不依赖其完成，也不改 `search`、`list` 或 Index Runtime 的任何搜索协议。

### Resulting Impacts

- 两领域 parser、类型、CLI help 与入参、candidate/正式 mutation、图/trace DTO、index Schema、generated declaration/bundle 和关系 fixture 都需要同步演进；仅改一个领域会使共同契约不成立。CLI tests 要逐入口证明 selector 先按领域既有 ID-first/name 解析，再按矩阵中的完整 relation set 绑定、保留或清除摘要，而 API tests 直接传 relation object。
- 摘要是可选 JSON/YAML 属性而非空字符串占位。历史 sources 和持久 indexes 若按各领域兼容规则读取，必须保持可读；需要升级 definition/schema 时，完整同步从 Markdown 重建，不能由索引反向补写摘要。
- trace 和图输出增加可选显示信息，但既有只按 type/target 的 consumer 不能被要求提供摘要或改变关系选择。输出和 API 测试必须区分“省略”与新增文字可见，不把摘要当作新的 selector。
- metadata search Change 可以在自己的 Plan 中将 relation summary 加入白名单或排除；双方只以投影字段可用为协调点，不复制搜索判断、测试或实现任务。

## Risks / Trade-offs

- Decision 与 Investigation 的 relation CLI 写入方式不同；统一的 target-selector 表面必须在各自 parser 中保留既有 ID-first/name 解析，并在 Investigation 的多 source group 中隔离归属。逐入口 CLI tests 必须覆盖 summary 未命中、重复 target、summary-only、`--clear-relations` 排斥和完整替换的保留/清除，避免误改其他边。
- Unicode 码点若按 UTF-16 code unit 计数会错误处理代理对；实现和 fixtures 必须以 Unicode 码点计数，测试边界字符而非只测试 ASCII。
- 增加 index relation 字段会使 schema/definition、source revision 与生成制品联动；不可把仅修改手工 JSON 当作同步完成。

## Open Questions

无。
