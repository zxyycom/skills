---
name: decision-records
description: >-
  用于长期决策管理。当用户正在作出可能持续影响后续行为、owner、边界、
  兼容性、风险处理或验收方式的决定，恢复或审阅既有长期判断，拟议决定与
  既有决定冲突，或明确构造决策待提交快照时使用。
metadata:
  version: "48"
---

# Decision Records

## 目标

维护可回放、可验证、可演进的长期判断。决策记录保存采用方向、理由、生命周期和演进关系；它不保存任务进度、执行日志或当前实现快照。代码、配置、规范和项目文档仍是当前事实来源。

每条记录在 Markdown frontmatter `id` 中声明 extensionless 稳定 **Decision ID**。新记录使用 calendar-valid `YYMMDD-<name>`；普通输入先按标准 ID 精确解析，失败才按 name 查找。`sourcePath` 单独定位当前文件，basename 可以等于 ID 或使用语义文件名，移动或改 basename 不自动改变身份。格式、位置、分类、关系与索引契约由决策记录规则和 Schema 承接。

`active + aligned` 是已核对的当前基线；`active + unaligned` 是已经确认、但尚未成为当前事实的未来方向，是正常的长期状态而非失败、待办或实施授权。`candidate` 可以是结构合法 scaffold，也可以已经机械满足正文要求；两者都不进入正式集合。CLI 的 `scaffoldValid` 与 `bodyReady` 只表达机械事实，不证明语义审核、建立授权或 alignment 判断。`alignment` 不创建实施授权、任务或优先级。

## 内容 owner

1. 本文件面向 agent，承接触发、读取路径、动作选择和交付验收。
2. [决策记录规则](references/decision-record-rules.md) 面向写入和结构维护，承接格式、身份、分类、生命周期、关系、索引与事务不变量。
3. [Decision Index Schema](references/decision-index.schema.json) 承接索引的精确机器结构、字段、版本与序列化约束。
4. `scripts/decision-records.mjs --help` 承接当前 CLI 参数、输出和退出状态。
5. [状态与维护恢复](references/maintenance-recovery.md) 承接首次候选集合，以及 CLI、索引或写入恢复的异常路径；只在这些条件触发时读取。运行时诊断的字段、warning 与 mutation outcome 边界以固定规则为准。

## 主动读取

1. 先读目标工作区指令和当前任务直接相关的事实来源。
2. 按 `--root` 和可选 `--decisions-dir` 定位集合；集合整体不存在时视为尚未初始化，不从 Git 状态推断决策是否存在或生效。
3. 审核尚未建立的记录时，先运行 `candidates`，再按需用 `show-candidate <decision-id>` 审核正文。
4. 已知准确 Decision ID 或可靠 name 时用 `show <decision-id>`；已知 status、alignment 或 tag 时用 `list` 做结构化浏览；需要已知记录的前序或后继时用 `trace <decision-id>`。不要由 basename、`sourcePath` 或 `trace` 之外的引用猜身份。
5. 只知道主题、概念、理由或正文措辞而不知道 ID 时，用 `search <text>`，再以结果中的完整 ID 调用 `show` 或 `trace`。省略 `--in` 等于 `--in content`：它在 active 已建立记录的权威 Markdown 中搜索。`--in metadata` 只搜索已发布索引快照；两种范围都先应用 status、alignment、tag 条件，并支持 `--match all|any|phrase`。三种模式统一 NFKC、忽略大小写并按空白处理；`all`、`any` 可分别由同一记录的多个 content 物理行或 metadata segment 满足，`phrase` 只能位于一个物理行或一个 metadata segment。
6. content 的权威内容是被当前索引快照选中的 Markdown：候选和索引 JSON 不在范围内。索引缺失、损坏或不新鲜时，只有完整验证权威 Markdown 成功才可只读降级并 warning，绝不写索引；资源截断也会 warning，不能据未显示或无结果断言不存在。metadata 的权威内容是持久索引本身：它不读取实体、candidate 或 relation target，不检查来源新鲜度，也不回退。它将 ID、name、title、purpose、background、decision、每个 tag 和本来源记录的每条非空 relation summary 分别匹配；`matchedFields` 只列实际命中的普通字段，`matchedRelations(type, target, summary)` 只列实际命中的来源 summary，不返回 preview。metadata 快照可能滞后未同步的来源编辑，不能据此陈述当前实体事实；索引读取失败时先运行 `check` 诊断，修正后再在获得维护授权时运行 `sync-index`。
7. 摘要足够时停止扩大读取。只有任务需要历史时才查询 archived 记录或完整关系图。
8. 任何候选写入、已建立记录维护、identity rename、暂存快照或结构审阅前，完整读取决策记录规则，并按相应命令的 `--help` 执行；规则和 CLI 负责判定具体前置条件。任务需要在演进事务中删除一个决策时，以 `evolve --discard <decision-id>` 显式选择该动作。首次候选集合、索引异常或写入中断时，读取恢复手册，不把缺失索引直接当作需要重建的错误。
9. 手工修改已建立 Markdown、怀疑索引陈旧或准备维护时，先运行严格 `check`；需要接受合法来源变化时运行 `sync-index`。`sync-index --select <name-or-id>` 仍完整验证集合，只允许所选完整 ID 的变化进入工作区索引；先以 check 结果确认范围，再加 `--write` 发布完整投影。无 `--select` 保留全量重建。`stage` 是 Git pending 操作，不能替代同步。常规查询不逐次重扫全部 Markdown，也不能用陈旧索引断言来源不存在记录。

## 执行流程

### 1. 确定任务出口

1. 恢复、解释、检查或审阅已有决策时，只交付查询或审阅结果；没有维护授权时不扩大为写入。
2. 当前指令明确要求起草候选，且给出维护对象和影响范围时，可以用 `new` 写入规范 candidate scaffold，或继续编辑既有 candidate；不得据此推断方向已经确认。只有当前指令也确认完整方向及其对齐状态时才建立。
3. 普通工作形成重要取舍时，在自然更新或交付阶段提出候选；只有继续任务必须先确定取舍时才即时提出。
4. 长期含义、适用范围或被改变的责任边界不清楚时，只询问会改变记录结果的最小问题。

### 2. 恢复并使用当前判断

1. 从 `list` 的 tags、生命周期、对齐状态和摘要定位相关记录；从 `show` 的目的、背景和决策恢复长期结果、选择依据与必须遵守的限制。
2. 对每条直接相关的 active 决策判断：遵守已对齐基线、把未对齐方向作为方案输入、实施明确纳入本次交付的未对齐方向、处理一次性例外、形成长期修订，或报告一致性问题。
3. 已对齐记录与当前事实偏离时报告一致性问题，不改回 `unaligned`。新的未来目标通过新决策表达。
4. 只有当前任务明确把未对齐方向的全部或一部分纳入交付或验收时才实施；否则它只约束方案选择。可独立演进的部分不能用“部分对齐”表示，必须形成可独立演进的后继。

### 3. 提出候选

候选同时满足以下条件才进入决策根目录：

1. 会持续影响后续行为、责任边界、兼容性、风险处理或验收。
2. 缺少记录时，未来难以恢复为何采用该方向。
3. 是判断或取舍，而不是事实、任务、进度或执行结果。
4. 能作为整体独立修订、替代、归档和判断对齐。

在当前授权包含长期判断与维护范围时，使用 `new <decision-id>` 和 title、三项摘要、至少一个 tag 及可选直接关系创建 scaffold。创建成功后编辑固定的“目的、背景、决策”正文；`candidates` / `show-candidate` 显示 `scaffoldValid` 与 `bodyReady`。`new` 成功即退出 0，即使正文未完成或辅助预检无法完整选择；应继续编辑、查询或运行显式 preflight，不得对同一 ID 重跑 `new`。CLI 不替代语义审核。

### 4. 维护记录

1. 查询、关系和生命周期命令接收普通 selector：先移除一次末尾 `.md`、精确解析 calendar-valid 标准 ID，失败时才按 name 收敛为完整 Decision ID；`sourcePath` 只用于定位和展示，绝不参与身份解析。
2. `sync-index --select` 使用相同 ID-first selector，但从持久 baseline 与完整 current candidate 的 name 映射并集解析；标准 ID 不存在不得退回 name。新增、删除和 ID rename 分别选择新 ID、旧 ID、或同时选择旧/新 ID。baseline 不可信、集合 metadata 改变或出现未选择变化时零写入并改用全量同步或补充选择。
3. `new`、首次 `activate` 与 `evolve` 可把重复 `--relation-summary <decision-selector=summary>` 绑定到同次完整 `--relation` set 中唯一 target；它不是单边 patch。摘要 trim 后为空即省略，非空必须单行且不超过 40 个 Unicode 码点；不改变边身份或图验证，也不要求为旧边回填。各命令保留、替换、清除或拒绝摘要的精确矩阵由决策记录规则承接。
4. `activate` 只建立 body-ready candidate 或重新激活 archived 记录；`evolve` 只建立 body-ready selected candidates 并维护完整演进关系。`mark-aligned`、`archive` 与 `discard` 只用于各自维护动作。`activate --preflight` 与 `evolve --preflight` 使用当前完整参数只读预演关系、最终图、索引和 Git 历史门禁；结果不保存 receipt，正式命令必须重新显式提供参数并重新验证。`拆分` 和 `重划` 都通过重复 `--successor` 选择完整后继集合；重划通常由每个候选在自身 `relations` 中声明各自的来源边。`--relation` 是对所有所选后继的完整统一覆盖，不是逐后继参数；不新增重划专用命令。精确输入优先级、拓扑和闭合规则以 `--help` 和决策记录规则为准。
5. `rename <source-selector> <target-name-or-id> [--preflight]` 用于显式迁移或纠正单条 ID/name；它在领域事务内改写所有受管 relation target、保留 relation summary、重分配 sourcePath 并完整重建索引。source 与 target 的日期、legacy candidate、Git HEAD 确认和恢复边界均由规则与 CLI 判定；不得手改 ID、关系、路径或索引模拟 rename。
6. 已建立记录的判断语义变化通过新记录和真实关系表达；编辑性文字修正可直接改权威 Markdown。不得直接编辑派生索引制造状态。
7. 生命周期和关系写入使用 CLI 事务，尽可能保证 Markdown 与索引组合的原子性；普通诊断无法恢复的失败按恢复手册处理。不要在运行前自行推演 Git 历史边界；正常执行领域命令即可。CLI 实际暂停时，向调用方完整转达受检 Decision ID、操作和零写入状态；等待本次明确确认后，才按 CLI 给出的额外参数重试，不自动重试，也不把这个确认代替原有维护授权。
8. `discard` 删除完整且无剩余引用的 candidate、active 或 archived 决策；`evolve --discard <decision-id>` 将同一删除动作与关系事务原子组合。参数显式选择删除对象，适用条件和失败边界交给决策记录规则与 CLI 判定；成功时报告删除而非归档。

### 5. 构造待提交决策快照

任务需要 Git pending 快照或提交准备时，运行 `stage <selector...>`。它在同一 staging 快照中先读取 HEAD 与当前工作区的可识别 Decision 身份，再将标准 ID 或唯一 name 收敛为完整 ID；它只是将选中内容转换为完整 pending 快照，不改变决策生命周期。选择、已有 pending 和失败边界以决策记录规则与 `--help` 为准。生命周期命令不写入 pending。

### 6. 验证与交付

1. 候选任务确认候选具有长期回放价值，并报告 scaffold/body readiness；建立前先完成正文、语义审核与当前授权判断，active 记录只保存已确认判断。
2. 建立或对齐任务在操作前按规则核对完整方向与当前事实来源；只有完整方向成为当前事实后才能标记 aligned。
3. 已建立集合的维护任务在结束时运行严格 `check`；首次候选集合或故障恢复按恢复手册验证。
4. 写入时说明新增、修订、归档或对齐变化和实际验证结果；只读恢复时说明适用决策、分类和结果边界。
5. CLI 返回暂停提示时，已原样说明受检对象和零写入状态，并停下等待本次确认；只有明确确认后才按提示重试。
6. discard 任务说明删除对象与实际结果；嵌入 `evolve` 时同时说明最终关系。失败或未满足规则时不写入。stage 任务说明 selector 收敛后的完整 Decision ID 与生成的 pending 快照，并说明它没有改变生命周期。

## CLI

从 skill 目录运行，或使用脚本绝对路径：

```text
node scripts/decision-records.mjs <command> [options] --root <resolution-root>
```

| 命令 | 用途 |
| --- | --- |
| `new <decision-id>` | 从显式 metadata 创建不覆盖的 candidate scaffold。 |
| `rename <source-selector> <target-name-or-id>` | 预演或事务化迁移单条身份、关系、路径和索引。 |
| `candidates` / `show-candidate <decision-id>` | 发现 candidate scaffold、机械 readiness 或审核正文。 |
| `list` / `search <text>` / `show <decision-id>` / `trace <decision-id>` | 结构化浏览、从全文主题发现记录、恢复完整理由或演进关系。 |
| `check` / `sync-index [--select <name-or-id> ...] [--write]` | 严格只读验证；全量重建，或完整验证后仅接纳所选 ID 变化的索引同步。 |
| `stage <selector...>` | 在 staging 快照中解析标准 ID 或唯一 name，并构造待提交决策快照。 |
| `activate` / `evolve` / `mark-aligned` / `archive` / `discard` | 维护生命周期、关系和候选；`activate/evolve --preflight` 只读预演，`evolve --discard <decision-id>` 可在关系事务中删除一个决策。 |

精确参数、输出和退出状态以 `--help` 为准；索引的精确字段、版本和格式由相邻 JSON Schema 承接。

## 完成标准

1. 只读恢复已恢复全部直接相关的 active 决策，并说明其对当前任务的作用和边界。
2. 候选起草或维护已遵守决策记录规则，并说明候选、修订、归档或对齐的实际变化。
3. 已建立集合维护已通过严格 `check`；首次候选集合和故障恢复已按维护恢复的适用路径验证。
4. CLI 返回暂停提示时没有自动重试；任务已停在零写入边界，或在取得本次明确确认后按提示继续。
5. discard 已报告删除对象、最终关系和不满足规则时的零写入结果。
6. 暂存任务只报告显式选择的 Decision ID 与生成的 Git pending 快照，并说明没有改变生命周期。无法完成相应验证时，按恢复手册说明未证明的边界。
