# Tasks

任务先同时核对两个领域的 relation 输入、图与索引边界，再以同步实现和跨领域兼容验证交付，不建立先后试点。

## Readiness
- [ ] 0.1 审计 Decision `new`、`activate`、`evolve` 与 Investigation `new`、`set-relations` 的现有完整 relation replacement/保留/clear 行为、ID-first/name selector parser、source group 边界、公开 API、图/trace DTO、rename 和 index schema/definition，确认 design 命令矩阵逐入口可落地。
- [ ] 0.2 固定两个领域共用的规范化与错误矩阵：纯空白省略、trim、物理换行拒绝、以 Unicode 码点计数的 40 码点边界、超长不截断，以及 summary 对 type/target 去重、排序、时间方向、形状和无环验证零影响。
- [ ] 0.3 审阅 `add-index-only-metadata-search` 的 metadata projection 消费边界，确认本 Change 只提供 index relation summary，不修改其字段白名单、匹配、`--in`、fallback 或测试职责。

## Implementation
- [ ] 1.1 为 Decision relation 增加可选 `summary` 的 Markdown/parser/renderer、直接 relation object API 与 `--relation-summary <target-selector=summary>` CLI 输入；逐一实现 `new`、新 candidate `activate` 和 `evolve` 的 design 矩阵，包括 candidate 保留、统一 override 复制、archived reactivate 拒绝 override，以及未提供 summary 的省略/清除规则。
- [ ] 1.2 为 Investigation relation 同步增加等价 `summary` 契约、Markdown/parser/renderer、直接 relation object API 与相同 CLI 输入；逐一实现 `new` 与多 `--source` group 的 `set-relations` 矩阵，包括 group 内任意顺序、group 结束绑定、完整替换省略清除和全部拒绝条件，不以 Decision 作为试点或兼容替代。
- [ ] 1.3 同步更新两个领域的关系图、show/trace/API 投影、index state/schema/source revision、sync-index 与 rename，使摘要可见且 target 改写时保持不变，同时保证图算法不读取它作身份或拓扑判断。
- [ ] 1.4 按各自 build owner 更新受影响生成 bundle、source map、声明和 Schema，并更新两个 skill 的 relation/trace/索引与 CLI help 说明；不修改 metadata search 行为 owner。
- [ ] 1.5 为新增或调整的最小原生测试入口创建/更新 Decision 与 Investigation Test Evidence case，并同步派生证据索引。

## Verification
- [ ] 2.1 运行两个领域 relation parser/mutation/API 测试，覆盖缺省旧关系、纯空白省略、trim、单行、40 Unicode 码点边界、多行和超长拒绝且无截断；API 直接传 `{ type, target, summary? }`，不使用 CLI 编码。
- [ ] 2.2 运行两个领域图和 trace 测试，证明有摘要时图/trace/API/index 可显示，且摘要变化不会改变 type/target 去重、规范排序、时间方向、关系形状或环检测。
- [ ] 2.3 运行两个领域 CLI help/API 与逐入口命令矩阵测试：Decision `new`、新 candidate `activate`、archived reactivate、`evolve` 的保留/统一 override/不同 successor source 摘要路径；Investigation `new` 与任意顺序、多 source group 的 `set-relations`。覆盖首个 `=` 分隔、ID-first/name target、完整 set 唯一 target、summary-only、重复、`--clear-relations` 排斥、未提供 summary 的清除与 generated artifacts 当前。
- [ ] 2.4 运行两个领域 rename 与 sync-index 检查，证明摘要在 target rename 后保留、历史无摘要来源无需迁移。
- [ ] 2.5 检查 `add-index-only-metadata-search` 没有被本 Change 修改；确认 relation summary 仅作为其可选索引投影输入，而搜索细则仍由该 Change 承接。
- [ ] 2.6 运行 Test Evidence catalog 检查和 `bun run check`，人工审阅两个领域没有被拆成先后试点，且空白/超长/图身份/命令矩阵边界没有被误表述。
