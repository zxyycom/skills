---
name: investigation-report
description: >-
  在用户明确要求记录、沉淀、创建、更新或审阅调查报告时，创建、维护或审阅一份可独立复核的调查报告。
  每份报告以稳定 Investigation ID 保存一轮形成时的背景、依据、结果和边界；tags 用于分类，显式直接前序关系用于认识演进。
  当前事实、长期方向与实施授权继续由各自 owner 承接。
metadata:
  version: "37"
---

# Investigation Report

## 目标与适用范围

用一份报告保存**一轮形成时认识**，使未参与原对话的读者仍能复核调查背景、问题、实际依据、结果和适用边界。正式报告 Markdown 是该轮认识的语义 owner；可选资源保存复核材料，索引从正式报告重建并提供查询。新记录 ID 使用 `YYMMDD-<name>`；name 不写入 frontmatter，但由 ID 投影为索引 key 和普通 selector。文件 basename 可以使用语义文件名而不改变身份。

直接前序关系描述认识如何演进。所有已建立报告留在同一正式集合；需要当前口径时，以当前事实 owner 为准并按需综合相关报告。明确要求剔除正式报告时使用 `discard`。

仅在用户明确要求把调查沉淀为报告，或创建、更新、审阅调查报告时使用。普通调查、排障和问答沿当前任务交付。调查形成长期方向、实施任务或稳定测试义务时，交给当前环境的对应 owner。

## 内容 owner 与读取路径

1. 本文件承接报告形成与审阅、候选 authoring、关系判断、资源取舍和维护流程；领域调查方法与当前事实由相应任务和 owner 承接。
2. [固定契约](references/investigation-report-contract.md) 承接报告与候选的身份、结构、关系、资源、索引、CLI、事务与运行时诊断。创建、publish、调整关系、剔除或结构审阅前完整读取。
3. [维护恢复](references/maintenance-recovery.md) 承接 warning、mutation outcome、锁、权限与中断写入的操作者恢复边界；只在相应诊断或恢复条件出现时读取。
4. 先读取工作区指令：已知准确 ID 或 name 时用 `show`；已知 tags、formedAt 或关系类型时用 `list`；只知道主题、概念、原因或正文措辞时用 `search`；需要前序或后继时用结果中的完整 ID 调用 `trace`。候选仍用 `candidates`、`show-candidate` 审阅。省略 `--in` 等于 `--in content`，即搜索正式报告 Markdown；`--in metadata` 只搜索已发布索引快照。两种范围都先应用 tags、formedAt、关系类型条件，且统一 NFKC、忽略大小写并按空白处理 `all|any|phrase`。`all`、`any` 可由同一报告的多个 content 物理行或 metadata segment 满足，`phrase` 只能位于一个物理行或一个 metadata segment；`--limit` 只限制已形成的完整确定匹配集（默认 50、最大 1000）。
5. content 的权威内容是当前索引快照选中的正式 Markdown，候选、资源和索引文件一律排除；索引缺失、损坏或不新鲜时，只有完整正式来源与资源验证成功才可只读降级并 warning。metadata 的权威内容是持久索引：它不读取报告、candidate、资源或 relation target，不检查来源新鲜度，也不回退。它分别匹配 ID、name、title、question、每个 tag 和本来源记录的每条非空 relation summary；`matchedFields` 只列实际命中的普通字段，`matchedRelations` 只列实际命中的来源 `{ type, target, summary }`，不返回内容预览。metadata 快照可能滞后未同步来源，不能据此陈述当前报告事实；索引读取失败时先运行 `check`，修正后在获得维护授权时运行 `sync-index`。content 的截断 warning 表示返回或预览受资源上限限制，不能把未显示结果或无结果说成不存在；应收紧筛选、调整 `--limit`，或用已返回 ID 的 `show`/`trace` 深入读取。

## 常用 CLI

从 skill 目录运行；在其他位置使用实际安装路径：

```text
node scripts/check-investigations.mjs <command> [options] --root <workspace-root>
```

| 目的 | command | 前置与作用域 |
| --- | --- | --- |
| 创建集合外 authoring scaffold | `new <investigation-id> ...` | 原子、不覆盖地创建一个 candidate；创建成功即退出 `0`。 |
| 审阅候选 | `candidates` / `show-candidate <selector>` | 读取候选及机械 readiness，不构成语义审核或 publish 授权。 |
| 迁移或更正身份 | `rename <source-selector> <target-name-or-id>` | 预演或事务化改写 ID/name、relation target、路径、资源 owner/reference 与正式索引，并保留 relation summary。 |
| 预演候选发布 | `publish <selector...> --preflight` | 只读验证当前正式基线与显式选择的最终集合。 |
| 正常建立选中候选 | `publish <selector...>` | 重新检查后，只把显式选择的 candidates 事务化建立为正式报告。 |
| 丢弃候选 | `discard-candidate <selector>` | 只删除显式候选及经确认的候选 owner 资源。 |
| 结构化浏览正式报告 | `list` | 读取当前正式索引，忽略 candidates。 |
| 按主题发现正式报告 | `search <text> [--in content\|metadata]` | 默认搜索正式报告 Markdown，返回 ID、摘要和命中预览，并在索引不可用或不新鲜时只读降级；metadata 只查询已发布索引并返回命中字段和 relation summary，不读取实体或降级。 |
| 读取完整正式报告 | `show <selector>` | 通过当前正式索引定位报告。 |
| 追溯正式关系 | `trace <selector>` | 查询当前正式索引中的关系图。 |
| 编辑期间检查所选正式报告 | `check --id <investigation-id>` | 只检查所选正式报告及其直接资源，不检查索引新鲜度。 |
| 验证完整正式集合与当前索引 | `check` | 只读检查完整正式集合；合法 candidates 只产生候选诊断。 |
| 恢复或受限接纳正式来源 | `sync-index [--select <name-or-id> ...] [--write]` | 全量重建，或完整验证后只接纳所选 ID 的正式来源变化；忽略合法 candidates。 |

普通 selector 统一先解析标准 ID，再以 name 查索引。`sync-index --select` 从 baseline 与完整 current candidate 的 name 映射并集收敛 ID，标准 ID 不存在不回退 name；它默认 check，添加 `--write` 后才发布完整索引。`stage-index` 在自己的双索引 staging 快照内按同一规则将 selector 收敛为完整 ID，不能替代同步。`set-relations`、`discard` 和其他参数通过 `help <command>` 与固定契约取得。

## 工作流程

### 1. 选择正确操作

1. 判断既有正式报告时执行只读审阅；判断未建立内容时先审阅 candidate。
2. 新证据、不同条件下的复查或实质认识变化形成新的完整报告。
3. 原报告未准确保存当时认识，或存在格式、链接等记录错误时，才原地修正；frontmatter `id` 是稳定身份，basename 和 `sourcePath` 只表达存储位置，移动或改 basename 不自动改变身份。
4. 正常 authoring 时先用 `new` 创建 candidate，再编辑正文、资源与关系。candidate 不属于正式集合、不是 lifecycle 状态，也不进入正式索引或查询。
5. `scaffoldValid`、`bodyReady`、`resourceReady` 和 preflight 只表达机械准备事实，不证明正文可信、关系真实、资源值得保存、语义审核完成或已经获得 publish 授权。
6. candidate 创建成功后不因正文未完成、资源 attention 或辅助预检不可用而重跑 `new`；继续编辑、查询候选或运行显式 `publish --preflight`。只有获当前任务授权且完整内容经过人工审阅后才 publish。
7. 正式根目录的完整报告一旦写入即已建立。`publish` 是 candidate 的正常建立入口，但不是形式上的唯一建立动作；手工正式来源变化可由显式全量 `sync-index` 接纳，或在完整集合验证后由 `sync-index --select ... --write` 仅接纳所选 ID 变化。剔除正式报告需要明确授权并使用 `discard`。

### 2. 形成可独立复核的报告

1. 按当前任务适用的方法取得证据，将一份报告限定为一轮能够独立汇报的认识。
2. 让四项固定核心共同回答本轮问题：

   | 核心内容 | 必须让读者恢复的内容 |
   | --- | --- |
   | 形成时背景 | 当时发生了什么，以及促成调查的已知事实、假设、未知和约束。 |
   | 调查目的 | 本轮的具体问题、准备支持的判断和预定边界。 |
   | 调查范围与依据 | 实际检查对象、来源、时点或版本、方法、覆盖范围和未覆盖内容。 |
   | 调查结果与边界 | 已确认事实、推断、建议、实际动作和未知；适用条件、不可外推范围与重新调查条件。 |

3. 把决定主张强度的条件写入相关核心：计量说明样本、指标、窗口与误差；因果说明候选解释、直接证据与未闭合环节；方案说明授权、恢复与验证边界。
4. 区分确认事实、推断、建议、实际动作与未知，使结论强度与实际依据一致。实验和其他副作用遵循当前任务授权，正文与资源只保留复核所需的最小非敏感信息。
5. 审阅先判断报告是否忠实、完整地保存形成时认识；用户需要当前适用性时，再对照相关报告与当前事实 owner。后来认识需要沉淀时形成新的复查报告。

### 3. 分类、关系与资源

1. tags 表达有正文依据的可检索分类。
2. 独立认识使用空关系；有直接前序时，根据认识变化选择 `补充`、`复查`、`修正`、`推翻`、`归并` 或 `拆分`，合法语义与图形以固定契约为准。
3. candidate 在 `new` 时声明完整直接关系；已建立报告通过 `set-relations` 事务调整完整关系集合。每条边可带从 source 报告视角说明该边的可选短摘要：trim 后为空即省略，非空必须单行且不超过 40 个 Unicode 码点，不参与图语义，也不要求为旧边迁移。CLI 的 `--relation-summary <target-selector=summary>` 只绑定本次完整关系集中的唯一 target；`set-relations` 时它属于最近的 `--source` group。程序化 API 直接在 relation 对象上提供 `summary`；命令矩阵、拒绝条件、rename/index/trace 投影以固定契约为准。publish 只接受能由正式基线和同批 selected candidates 闭合的最终关系图。
4. 正文和稳定事实 owner 足以复核时直接使用它们；需要保留额外形成时材料时，保存最小必要资源，并在正文说明来源、条件、关键事实与支撑作用。
5. candidate 与正式报告都使用 `./_resources/<resource-id>` 链接。candidate 的自有资源预置在最终 owner 路径；它也可共享既有正式 owner 资源。publish 不改写链接、不移动资源或自动暂存资源。
6. 新取得的实质材料随新报告使用新资源；原地修改资源只用于准确恢复当时材料、格式修复或移除敏感信息。秘密与认证材料不进入报告或资源。

### 4. 同步、检查与交付

1. 写入操作需要当前任务授权；只读审阅运行适用的 `check` 或 `publish --preflight` 并保持集合状态不变。
2. `publish --preflight` 不保存 receipt 或确认；普通 publish 必须在集合 mutation lock 内重新读取正式基线、候选和资源并完整验证。预检通过不替代 publish 授权。
3. `sync-index` 是正式集合的低频全量恢复与接纳入口。`--select` 仍读取并验证完整正式集合，只在可信 baseline、集合 metadata 不变且全部变化都被选择时才可发布完整 projection；新增、删除和 ID rename 分别选择新 ID、旧 ID、或同时选择旧/新 ID。编辑一批手工正式报告期间允许索引暂时陈旧，并用 scoped check 获取局部反馈；在索引查询、已有关系事务、正式 `discard`、默认全量检查、`stage-index` 或交付需要当前集合前统一同步一次。合法 candidates 不被同步或接纳。
4. `set-relations` 与正式 `discard` 要求当前索引，并在成功事务中同步索引；它们不修改 candidate。只改资源字节时保留当前索引。暂停、失败或 cleanup 诊断按固定契约处理和报告。
5. publish、同步或事务完成后运行默认全量 `check`，再人工审阅正文证据质量、敏感信息、历史修正正当性和关系语义。
6. 需要 Git pending 快照时，在同步和全量检查后用 `stage-index` 的标准 ID 或唯一 name 选择对应正式 Investigation；正式报告与资源按实际交付范围另行选择，candidate 不由它暂存。

## 完成标准

1. 任一正式报告都能独立恢复形成时背景、目的、实际依据、结果与适用边界，主张强度与证据一致。
2. tags、直接前序关系和资源各有正文依据；候选在 publish 前另有 scaffold/body/resource readiness 与完整 preflight 证据。
3. 只读审阅说明可确认范围、问题与未知；写入维护完成对应同步、默认全量 `check`、人工语义审阅和结果交付。
