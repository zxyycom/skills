# Owned envelope 原地冻结实施补证

本材料补充同轮调查在 2026-10-24 16:48 UTC 的实施判断与正确性证据，不是新的性能样本。首次性能资源不改写；报告 ID 与 formedAt 不变。源码基线 HEAD 为 `a661d059fd782a476d094410c40fe706ff394d3a`，工作区另有并行测试／Gate 整改，不能称为该 HEAD 的干净完整环境。

## 最小候选与责任

| 候选 | 正确性及维护面 | 选择 |
| --- | --- | --- |
| 保留 `cloneAndFreezeTypedJsonObject` | 复用既有通用 helper；在固定 JSON schema 后继续整体递归复检、复制、冻结，自有 envelope 没有需要复制隔离的外部别名。 | 正确但保留重复工作。 |
| 私有 `freezeOwnedEnvelope` | 只在 `snapshot-parser.ts` 的成功通用 envelope 边界使用；新增一个局部所有权前提及小型递归函数，不引入依赖、状态、公开模式或新模块。 | 选定；删除重复递归复检＋复制，保留递归冻结。 |
| 通用 helper 增加“是否复制”参数／品牌／缓存 | 将所有权前提分散给其他调用方，增加模式、状态或跨 owner 责任。 | 当前没有消费者需要。 |
| 删除冻结或把所有 clone 改成原地冻结 | 前者暴露可变 callback 输入；后者可能冻结领域 parser 返回的外部共享对象。 | 不通过正确性门槛。 |

这不是“所有场景更快”的结论。原 IR selected 延迟／CPU 和 IR RSS 反向样本仍有效，原因未闭合；没有用新的正确性测试计时抵消或重解释它们。采用标准是保持已有契约并以局部、低维护机制消除已证明的重复工作，容许合理常数取舍；未新建性能 SLO。

## 所有权证据

读取范围：`tools/index-runtime/src/{snapshot-parser,validation,schemas,record,json,projection,canonicalization,frozen-json}.ts` 及实际安装 Valibot 1.4.2 的 `dist/index.mjs` 中 `custom`、`strictObject`、`record`、`transform` 实现。

1. `parseStateIndexEnvelope` 的唯一原始输入是 text；无 reviver 的 `JSON.parse` 创建本调用 graph。密封前没有领域 callback。
2. `validateStateIndexValue` 保留版本、ID、严格 schema、expectation 与 revision 成员检查及原错误映射。
3. 固定通用 `stateIndexSchema` 无默认值或外部对象注入。metadata/state 的 `v.custom(isJsonObject)` 只检查原 graph：实际 `custom` 的 `~run` 仅按 check 设置 typed，不替换 value。`isJsonObject` 递归拒绝非有限数值；标准文本 `1e999` 解析出的 Infinity 因而仍在 seal 前失败。
4. Valibot `strictObject`／`record` 创建新外壳，字段来自输入／对应子 schema。安全 record 的编码和解码转换都经 `Object.fromEntries` 创建新 record，不把 prototype-like own key 当 setter；转换没有外部引用来源。
5. 成功 graph 由本次 JSON 输入及上述外壳组成。普通 JSON 不产生 getter、symbol、环或外部对象别名，因此私有 helper 不承担通用对象验证或 visited-set 责任。`Object.values` 遍历对象 own enumerable 属性及 JSON 数组成员，`null` 与其他标量原样返回。
6. 领域 `parseMetadata`／`parseState` 运行在 seal 之后，输出仍是不可信的另一所有权边界。`projection.ts` 与 `canonicalization.ts` 的校验、复制和冻结全部保留；完整图／查询字段校验及持久序列化也未变。

若未来固定通用 schema 引入可变外部默认值或转换，本所有权前提需要重新判断；当前不为假设变体增加公开框架。

## 实际修改

- `tools/index-runtime/src/snapshot-parser.ts`：删除 envelope 对通用 clone helper 的调用和 import；在同一 owner 加私有原地递归冻结。
- `tools/index-runtime/tests/owned-envelope-seal.test.ts`：五个稳定命名的 `node:test` 原生节点；只观察结果、冻结、别名与诊断，不匹配生产源码文本。
- `tools/index-runtime/tests/run.ts`：追加一个 import，使新节点进入 `test:index-runtime`。
- 五个新 Case 位于 `docs/test-evidence/cases/index-runtime-owned-envelope-{json,callbacks,errors,independence}.md` 和 `index-runtime-parser-return-isolation.md`；Tests ID 从 Bun JUnit 实际注册的 file/name 按当前项目实体规则恢复，主线程还须完成全集 snapshot/reference 检查及派生索引同步。

未修改 shared owner、其他现有测试、package/Gate、持久格式、schemaVersion／definitionVersion、跨调用缓存、Git 阶段获取／序列化或阶段顺序。没有 stage、commit、push。

## 验证与真实失败记录

以下命令均在仓库根运行；Bun 1.4.2，Node v26.8.2。定向测试也先在旧 clone 实现上执行，确认测试约束既有行为而非只适配新实现。

| 动作／命令 | 实际结果 |
| --- | --- |
| 旧实现：`bun test ./tools/index-runtime/tests/owned-envelope-seal.test.ts` | 首轮 4 pass／1 fail：fixture 的普通字符串替换误把 metadata 键替为数值，形成非法 JSON，实际 `json-invalid` 与预期 `schema-invalid` 不符。修成精确 label value 替换后 5 pass。产品代码未为此修改。 |
| 旧实现：`node --test tools/index-runtime/tests/owned-envelope-seal.test.ts` | 5 pass。 |
| 新实现：相同 Bun／Node 命令 | 各 5 pass。 |
| `bun run test:index-runtime` | 一次运行 91 pass／0 fail，5.85s，未因性能干扰重跑；包含既有阶段 fresh／CAS／漂移及 FS／pending 保护节点。 |
| `bun run typecheck` | 首次失败：新测试在 assert 已收窄 status 后仍作无交集分支判断，以及递归 JSON 成员缺少显式注解，共 7 条测试类型诊断；删除冗余分支、补类型注解后 exit 0。生产实现未改。 |
| 修正后：相同 Bun／Node 定向命令 | 各 5 pass；测试行为和名称不变。 |
| `bunx --no-install oxfmt tools/index-runtime/src/snapshot-parser.ts tools/index-runtime/tests/owned-envelope-seal.test.ts tools/index-runtime/tests/run.ts` | exit 0；后续只对调整过的新测试再次格式化。 |
| `bunx --no-install oxlint --deny-warnings tools/index-runtime/src/snapshot-parser.ts tools/index-runtime/tests/owned-envelope-seal.test.ts` | exit 0。 |
| JUnit 注册采集：`bun test ./tools/index-runtime/tests/owned-envelope-seal.test.ts --pass-with-no-tests --test-name-pattern=a^ --reporter=junit --reporter-outfile=<temporary-file>` | exit 0，5 个 skipped 原生节点，逐项恢复真实 file/name 及 Tests ID。首次手工采集遗漏 `--pass-with-no-tests`，因匹配零执行节点 exit 1，随后按项目采集入口补齐；不是产品测试失败。 |

聚合 91/91 在测试冗余类型分支清理前完成；清理后定向 5/5 和全仓类型检查重新通过。主线程完整 Gate 应消费最终工作树，不以这份记录代替后续来源一致性证明。

## 针对性变异

具体逐节点结果、命令和最终源码／测试 SHA-256 见同目录 `implementation-validation.json`。每个变异单独复制 Index Runtime 源码与目标测试，依赖与未改 shared owner 只读链接；未修改工作区源码。临时变异及注册目录都在退出时删除，不保留临时产物。

| 变异 | exit | 识别它的节点 |
| --- | --- | --- |
| 未变异控 | 0 | 全部 5 个通过。 |
| 移除 envelope seal | 1 | JSON/冻结、callback 输入、独立 parse 的冻结观察。 |
| envelope 仅浅冻结 | 1 | 同上，嵌套对象仍可变。 |
| 将 JSON 数字有限性检查改成全接受 | 1 | 原始 envelope 错误矩阵，拒绝语义丢失。 |
| 把通用 clone helper 错改为原地冻结 | 1 | parser 外部 mutable 对象隔离，外部对象被冻结。 |

这是有针对性的辨错证据，不是全面 mutation score，也不覆盖所有可能故障。

## 消费者与主线程交付边界

源码 import 及当前生成文件交叉确认共有四个分发消费者：

| Skill | 源码责任示例 | 需要同步／检查 |
| --- | --- | --- |
| Decision Records | `tools/decision-records/src/decision-index-definition.ts` | `sync:decision-records-cli`／`check:decision-records-cli` |
| Investigation Report | `tools/investigation-report/src/investigation-index-definition.ts` | `sync:investigation-report-check`／`check:investigation-report-check` |
| Novel Cards | `tools/novel-cards/src/index.ts` | `sync:novel-cards-cli`／`check:novel-cards-cli` |
| Test Evidence Review | `tools/test-evidence/src/core-index.ts` | `sync:test-evidence-cli`／`check:test-evidence-cli` |

四份受影响分发文件均为 `skills/<skill-name>/scripts/runtime/tools/index-runtime/src/snapshot-parser.ts`。共同 `tools/record-operations` 同样消费 Index Runtime，但不独立分发，仅经 DR／IR 的可达闭包进入包内；没有第五个 skill consumer。

本实现切面未执行四域 sync/version 或写共享 investigation／Case index；主线程统一版本提升、生成闭包和共享索引，并完成 `check:changed`／完整适用 Gate 及独立审查。当前没有新的冷缓存、大规模、dense graph、平台、retained-heap 或完整 CLI 性能证明。实际发布与远端生效也不由源码写入或局部测试推出。
