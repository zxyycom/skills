# Design

本设计把选择性暂存中的公共索引步骤收敛为纯 state 物化：领域先应用选中源变化并验证最终目标，`index-runtime` 再从完整基线成员与显式变化生成完整派生索引，共享 version-control 最后负责 `pending` 写入。

## Context

以下稳定 owner 约束本设计：

- [`index-runtime` 领域接入契约](../../tools/index-runtime/README.md)规定 `StateSnapshot`、metadata、state/id/key 投影、完整 `validateIndex`、确定性序列化和 revision 新鲜度语义。
- [按指定决策构造待提交快照](../../docs/decisions/decision-records/stage-selected-decisions.md)规定 decision-records 的目标源由 revision 基线叠加显式 filesystem 路径形成，既有 `pending` 不参与构造。
- [版本管理中间层](../../tools/shared/version-control.md)拥有完整 `pending` 范围替换、并发前提和失败恢复；`index-runtime` 不依赖该 owner。

本 change 使用以下术语：

| 术语 | 含义与 owner |
| --- | --- |
| 基线源集合 | 领域从 version-control revision 读取的权威源；它不进入公共物化 API。 |
| 目标源集合 | 领域先把显式选择叠加到基线源集合，再按当前规则完整校验后得到的权威源集合。 |
| version-control revision | 已提交基线的版本标识，也作为写入 `pending` 时的并发前提；它不写入派生索引。 |
| 基线成员 | 公共物化 API 接收的完整旧成员清单；每个成员是完整 state 或仅身份成员。 |
| 完整 state 成员 | 提供可被保留或替换的 state；公共层在基线 metadata 下恢复其旧 id。 |
| 仅身份成员 | 只提供旧 id，不提供旧 state；它表示调用方已选中该旧成员，本次变化必须替换或删除它。 |
| 选择变化 | `upsert` 表示新增或替换 state，`delete` 表示按基线 id 删除旧成员。 |
| target-first | 领域先把选中变化应用到基线源，再验证完整目标；不会先要求即将被替换或删除的旧源通过当前 parser。 |
| 目标 metadata/source revision | 由领域从目标源集合得到；公共 API 的 `target.revision` 表示 snapshot source revision，并写入结果的 `sourceRevision`，不是 version-control revision。 |
| companion files | 领域决定与派生索引一起写入 `pending` 的权威源文件；`index-runtime` 不读取或写入。 |
| `pending` | 共享 version-control 暴露的下一版本快照；Git index 只是当前内部实现。 |

固定责任链如下：

1. 领域从 version-control revision 与显式选择构造并验证完整目标源，同时准备基线成员、选择变化和目标 metadata/source revision。
2. `index-runtime` 只在内存中应用变化，重新构造、规范化并完整校验目标派生索引。
3. 领域核对索引与目标源同源并准备 companion files，共享 version-control 最后完整替换对应 `pending` 范围。

已确认的现状如下：

1. `buildStateIndex` 先调用 `definition.read(context)`，再完成 snapshot 外形、metadata、逐 state 解析、id/key 投影、规范化、完整结构和领域 `validateIndex`。`StateSnapshot.revision` 最终保存为 `StateIndex.sourceRevision`。
2. 内存调用方目前只能覆盖 definition 的 `read`。decision-records 的 `buildDecisionIndexFromSnapshot` 正通过这条路径构建 stage 索引。
3. decision-records 当前先在原始源文件层把选中 filesystem 路径叠加到 revision，再只对完整目标源执行当前格式、domain 和关系校验。选中的替换或删除因此可以移除一个已不符合当前规则的旧源。
4. decision-records 的索引 id 是决策根相对路径。adapter 已知选中旧路径，无需解析旧文件就能提供该旧成员的 id。
5. 查询态 `runtimeStates` overlay 只支持在既有 metadata 下按 id 替换或追加；它不删除、不改变 `sourceRevision`、不执行完整 `validateIndex`，也不返回新的完整索引。
6. state 投影不一定包含权威源的全部字节。公共层无法证明目标 source revision、选择变化和 companion files 来自同一目标源集合，这项证明继续由领域承担。
7. decision-records 与 investigation-report 都维护长期增长且经常并行演进的独立内容，并各自使用覆盖完整集合的单一派生索引；二者是选择性物化的主要现实消费者。decision-records 在本 change 中接入，investigation-report 通过 [`stage-selected-investigations`](../stage-selected-investigations/) 复用公共契约。
8. test-evidence 的集合结构同样适用，但其代码与证据变化较少并行推进；它只作为可选消费者，不承担本 change 的必要性证明或完成门禁。

## Goals / Non-Goals

目标：

- 让 `index-runtime` 完整拥有“基线成员 + 显式 state 变化 + 目标 metadata/source revision → 完整派生索引”。
- 允许调用方只为本次一定会被替换或删除的旧成员提供 id，避免在应用修复前解析其旧 state。
- 让 snapshot 直建、选择性物化和 filesystem 同步复用同一条目标投影、规范化与完整校验路径。
- 明确基线成员、旧 id、目标 id、变化冲突和 metadata 变化时的重新投影语义，使变化输入不依赖数组顺序。
- 用 decision-records 的既有 target-first 选择性暂存完成首次真实接入，并保证同一公共契约能够直接承接后续 investigation-report stage；领域源、关系校验、companion files 和 `pending` 继续由各自 owner 负责。

非目标：

- 不让 `index-runtime` 读取权威源、推导 source revision、选择 companion files 或构造版本管理快照。
- 不允许仅身份成员在没有对应变化时从目标集合静默消失。
- 不从索引 state 反向生成权威源；state 可能只包含源文件的部分投影。
- 不把查询态 runtime overlay 改造成持久写入或选择性物化入口。
- 不在本 change 中实现 investigation-report 或 test-evidence 的 stage 流程。

## Decisions

1. **snapshot 直建入口**：公开同步入口使用以下完整签名，不调用 `definition.read`，也不接收 `root` 或 reader：

   ```ts
   export function buildStateIndexFromSnapshot<
     State extends object,
     Metadata extends JsonObject
   >(
     definition: StateIndexDefinition<State, Metadata>,
     snapshot: StateSnapshot<State, Metadata>,
     options?: Readonly<{ signal?: AbortSignal }>
   ): StateIndexResult<StateIndex<State, Metadata>>;
   ```

   definition、snapshot、投影、规范化和完整校验语义与 `buildStateIndex` 相同。同步入口只保证在开始构建时拒绝已经 aborted 的 signal，不承诺在同步投影执行期间异步中断。现有异步 `buildStateIndex(definition, context)` 继续负责 source read 与对应错误映射，读取成功后把同一 signal 交给 snapshot 直建入口；因此 reader 返回后已经 aborted 时不再开始投影。

2. **基线成员类型**：公共层使用以下逻辑类型表达完整基线成员。`metadata` 用于恢复完整 state 成员的旧 id；基线不接收或保存 revision，因为结果只使用目标 source revision。

   ```ts
   export type StateIndexBaselineMember<State extends object> =
     | { readonly kind: "state"; readonly state: State }
     | { readonly id: string; readonly kind: "identity" };

   export type StateIndexBaseline<
     State extends object,
     Metadata extends JsonObject
   > = {
     readonly members: readonly StateIndexBaselineMember<State>[];
     readonly metadata: Metadata;
   };
   ```

   `kind: "state"` 的成员可以保留或被变化消费；`kind: "identity"` 的成员必须被本次 `delete` 或 `upsert` 消费，否则物化失败。所有成员共同构成完整基线成员集合，成员 id 必须唯一。

3. **选择变化类型**：公共变化使用可判别联合表达以下逻辑形态；最终 TypeScript 字段名以此契约为准，不使用函数调用顺序表达语义。

   ```ts
   export type StateIndexChange<State extends object> =
     | {
         readonly kind: "upsert";
         readonly replaceId?: string;
         readonly state: State;
       }
     | { readonly id: string; readonly kind: "delete" };
   ```

   `delete.id` 与 `upsert.replaceId` 都引用基线 id；`upsert` state 的目标 id 始终在目标 metadata 下计算。变化集合可以为空，但只要基线包含仅身份成员，变化集合就必须消费这些成员。公共入口不接收源路径、领域文件或 `pending` 参数。

4. **选择性物化输入与输出**：公开同步入口使用以下完整签名：

   ```ts
   export function materializeStateIndex<
     State extends object,
     Metadata extends JsonObject
   >(options: Readonly<{
     baseline: StateIndexBaseline<State, Metadata>;
     changes: readonly StateIndexChange<State>[];
     definition: StateIndexDefinition<State, Metadata>;
     signal?: AbortSignal;
     target: Readonly<{
       metadata: Metadata;
       revision: string;
     }>;
   }>): StateIndexResult<StateIndex<State, Metadata>>;
   ```

   空基线提供领域合法的 metadata 和空 `members`；目标结果可以为空。结果的 `sourceRevision` 只取自表示 source revision 的 `target.revision`。入口验证 baseline、target、members 与 changes 的运行时外形，不修改调用方提供的对象或数组；领域 parser、id、key 或完整校验失败继续映射为 `StateIndexResult`。同步取消语义与 snapshot 直建入口相同。输出不包含文本、companion file 列表或 `pending` plan；需要文本时调用方继续使用同一定义调用 `serializeStateIndex`。

5. **基线恢复**：公共层先验证 definition 和基线 metadata，再恢复完整基线成员集合：

   1. 对完整 state 成员，在基线 metadata 下执行 `parseState` 与 `identify`，得到规范的 state 和旧 id。
   2. 对仅身份成员，只验证 id 的通用文本外形，不尝试解析不存在的旧 state。
   3. 完整 state 与仅身份成员的旧 id 必须共同唯一；重复 id 失败。
   4. 基线阶段不运行集合级 `validateIndex`。所有最终保留的 state 会在目标阶段重新解析并接受完整校验。

6. **与顺序无关的变化归并**：公共层把变化解释为集合约束，不按输入数组依次修改：

   | 变化 | 基线消费语义 | 目标语义 |
   | --- | --- | --- |
   | `{ kind: "delete", id }` | `id` 必须存在且此前未被消费。 | 删除该基线成员。 |
   | `{ kind: "upsert", state, replaceId }` | `replaceId` 必须存在且此前未被消费。 | 在目标 metadata 下解析并加入 `state`。 |
   | `{ kind: "upsert", state }` | 先在目标 metadata 下解析 state 并计算目标 id；若同 id 的基线成员尚未被消费，则消费它。 | 消费成功表示同 id 替换，否则表示新增。 |

   同一基线 id 被两个变化争用时失败。显式 `delete(id)` 与不带 `replaceId`、目标 id 同为该字符串的 upsert 表示“删除后新增”，允许得到一个同 id 的目标 state；显式 `delete(id)` 与 `replaceId: id` 同时出现则因重复消费失败。多个 upsert 产生同一目标 id、保留 state 重新投影后与 upsert 冲突，或多个保留 state 在目标 metadata 下合并为同一 id 时，都以目标 id 冲突失败，不采用最后写入获胜。

7. **仅身份成员门禁**：变化归并完成后，每个未被消费的基线成员都必须含有完整 state。未被消费的仅身份成员使用稳定诊断失败；公共层不把它解释为隐式删除。这个门禁让领域可以跳过已选中旧源的解析，同时仍要求调用方提交完整、显式的成员变化。

8. **目标重新投影与完整校验**：基线消费完成后，公共层先在目标 metadata 下对所有保留 state 与 upsert state 执行目标成员预投影，重新运行 `parseState` 与 `identify`；多个最终成员得到同一 id 时返回 `state-index.target-id-conflict`。预投影通过后，公共层用这些最终 state 形成目标 `StateSnapshot`，使用调用方给出的目标 metadata 与 `target.revision`（source revision）调用 snapshot 直建路径。snapshot 直建仍对全部目标 state 运行完整的 `parseState`、`identify` 与 key 策略，并执行 field order、规范化、结构校验和领域 `validateIndex`；预投影不替代这条完整构建路径。metadata 改变不得沿用旧 id 或 keys。

9. **诊断与确定性**：`StateIndexDiagnostic.code`、`path` 与可用时的 `stateId` 是稳定契约；`message` 只用于解释，不作为兼容性键。definition、操作取消、metadata/state parser、`identify`、key 和完整后置校验继续复用既有 `state-index.*` code。基线解析产生的既有诊断使用 `path: "<baseline>"`，最终目标构建产生的诊断沿用 snapshot builder 的 path 语义。新增物化诊断固定为：

   | code | 触发条件 | `stateId` |
   | --- | --- | --- |
   | `state-index.baseline-invalid` | baseline、members 或成员联合外形无效 | 可恢复时使用对应旧 id，否则为 `null` |
   | `state-index.baseline-id-invalid` | 仅身份成员的 id 不是合法索引文本 | `null` |
   | `state-index.baseline-id-duplicate` | 两个基线成员恢复为同一旧 id | 重复的旧 id |
   | `state-index.target-invalid` | target 外形、metadata 或 source revision 外形无效，且未被既有 metadata 诊断覆盖 | `null` |
   | `state-index.change-invalid` | change 联合、`id` 或 `replaceId` 外形无效 | 可恢复时使用引用的旧 id，否则为 `null` |
   | `state-index.baseline-id-missing` | delete 或 replace 引用不存在的基线 id | 被引用的旧 id |
   | `state-index.baseline-id-consumed` | 同一基线 id 被不允许的多个变化消费 | 被重复消费的旧 id |
   | `state-index.baseline-identity-unconsumed` | 仅身份成员没有被任何变化消费 | 未消费的旧 id |
   | `state-index.target-id-conflict` | 多个最终成员在目标 metadata 下得到同一 id | 冲突的目标 id |

   新增物化诊断的 `path` 固定为 `null`。复用既有 parser、`identify` 或 key 诊断时，基线恢复使用 `path: "<baseline>"`；目标变化预投影使用 `path: "<target>"`；最终完整目标构建沿用 snapshot builder 的既有 path 语义。

   诊断按以下阶段产生：definition、开始前取消、baseline/target/change 外形、基线恢复、upsert 预投影、基线消费、目标成员预投影与 id 冲突、完整目标构建。一个阶段失败时不继续产生后续级联诊断；同一阶段收集全部可独立确认的问题，再按 `code`、`path`、`stateId`、`message` 排序后返回。相同逻辑成员与变化的排列必须产生相同规范化索引，或相同的诊断 code 与 `stateId` 集合；不能由数组中最先出现的变化决定业务结果。

10. **来源一致性边界**：仅身份成员的 id、目标 source revision 和变化集合都由调用方提供。`index-runtime` 只验证这些输入能形成符合 definition 的完整目标索引，不从 state 或 companion files 推导来源，也不证明仅身份 id 对应哪个旧源。领域必须在调用前完成目标源校验、基线成员集合、变化映射和 source revision 计算，并在写入前证明索引与 companion files 来自同一目标源集合。

11. **decision-records target-first 接入**：迁移后的 stage 保留现有外部语义，并按以下责任链执行：

   1. decision-records 从 version-control revision 读取目录表与完整基线原始源，并记录 revision 中的决策路径集合；首次集合继续使用 filesystem 目录表与空基线成员。
   2. decision-records 只把调用者显式选择的 filesystem 路径叠加到原始基线源，形成完整目标源集合；两处都不存在仍是输入错误。
   3. 现有 source builder 只对完整目标源集合执行决策格式、domain、引用目标和关系一致性校验，并得到目标 snapshot。目标为空仍按现有领域规则失败。
   4. adapter 用 revision 路径集合、选中路径和目标 snapshot 构造完整基线成员：未选中的 revision 路径从目标 snapshot 取得同路径 state，写为完整 state 成员；选中的既有 revision 路径写为 `{ kind: "identity", id: path }`，不读取或解析其旧 state。已有 revision 集合继续使用 revision 目录表对应的 metadata；首次集合使用目标 metadata。
   5. adapter 按选中路径在 revision 与 filesystem 中的存在性形成变化：新增使用普通 upsert；修改使用带 `replaceId: path` 的 upsert；删除使用 `delete(path)`。显式重命名仍由调用者同时选择旧、新路径，并映射为 delete + upsert，不由 stage 或公共层推断。
   6. `materializeStateIndex` 使用上述基线、变化和目标 snapshot 的 metadata/source revision 生成最终索引。选中旧源即使无法通过当前 parser，也不会在目标源校验前单独解析；未选中旧源仍作为目标的一部分接受完整领域校验。
   7. decision-records 同时用 `buildStateIndexFromSnapshot` 从已验证的目标 snapshot 构造只读对照结果，并要求对照结果与物化结果使用同一定义序列化后逐字节相同；这同时核对完整 entries、keys、metadata 与 `sourceRevision`，不只比较成员路径。随后重新解析物化文本，成功后把目标目录表、完整目标决策文件和该物化索引交给 version-control 替换 `pending` 决策范围。snapshot 直建结果只作为一致性对照，不替代最终 stage 的物化结果。

## Risks / Trade-offs

- 仅身份成员让公共层无法核对旧 id 与旧源内容的对应关系；因此它只能用于领域已显式选择且本次一定会消费的成员，未消费门禁和最终目标校验共同防止静默遗漏。
- 调用方仍可能提供与权威源不一致的基线成员集合、目标 source revision 或变化集合；公共层最多证明结果符合 definition 和目标输入，不能证明来源选择正确。
- metadata 变化要求重新解析、重新计算全部目标 id 与 keys；即使只选择少量变化，目标构建、排序和完整校验的成本仍随完整索引规模增长。
- 选择性物化不能替代领域的源文件叠加。源变化即使不改变 state 投影，也仍可能改变目标 source revision 和 companion file 内容。
- `replaceId` 引用旧的基线 id，而 `upsert` 的目标 id 在目标 metadata 下计算；adapter 必须显式保存这两个 id，不能依赖位置或变化顺序猜测。
- decision-records 为保留跨记录关系校验，仍需完整解析目标源；本设计保留现有修复能力，但不减少该领域的完整目标解析成本。

## Open Questions

无。
