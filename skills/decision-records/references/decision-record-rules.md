# 决策记录契约

本文件是 `decision-records` 的唯一固定契约，只承接精确存储、状态语义、维护事务和 CLI 行为。触发、语义恢复、偏离判断、候选确认和按任务出口交付由 `SKILL.md` 承接。本文将保存索引和 Markdown 的目录称为“决策根目录”。未传 `--decisions-dir` 时使用 `<root>/docs/decisions`；显式传入时，绝对路径直接作为目标，非绝对路径只相对 `--root` 解析。目标可以位于 `--root` 外部。

CLI 只接受本契约定义的当前 Markdown 格式，以及 `schemaVersion: 1`、`namespace: decisions`、`definitionVersion: 2` 的当前通用索引，不推断缺失元数据，也不提供非 Git 降级语义。Git 命令不可用、决策根目录不在 Git 仓库内或无法读取 `HEAD` 路径时，查询和维护直接失败。只有 `HEAD` 仍是有效符号引用且尚不能解析到任何版本时，才把仓库解释为尚无首个提交，并把 `HEAD` 路径集合视为空。

## Owner 与内容边界

1. 每条已建立决策 Markdown 是自身状态和语义的唯一事实源，承接 `status`、`alignment`、`createdAt`、标题、索引摘要、完整目的、背景、决策和直接关系。
2. 未激活决策候选只承接准备激活的完整判断和 `createdAt: null` 元数据；它不是已建立决策、没有生效，也不形成另一套持久状态。
3. `<decision-root>/decision-index.json` 是从全部已建立且有效的 Markdown 确定性生成的全生命周期查询投影，不拥有独立状态；删除后可以无损重建。
4. 代码、配置、规范和项目文档承接当前事实与行为；决策记录承接已经生效的长期方向、形成判断的背景、目标状态，以及必须长期遵守的限制、允许范围或例外。
5. CLI 承接 Markdown 元数据变化、索引重建、`HEAD` 路径核对、确定性检查和带诊断的查询，不保存缓存或隐藏状态。
6. 决策记录不保存任务清单、进度百分比、执行日志、完整对话、提交摘要、密钥、令牌、敏感个人信息或无助于后续判断的本机信息。

## 目录与稳定身份

```text
<decision-root>/
├── decision-index.json
└── <topic-id>/
    └── <semantic-slug>.md
```

1. `--root` 默认是当前工作目录，只作为默认决策根目录和相对 `--decisions-dir` 的解析基准；显式绝对 `--decisions-dir` 不受其目录边界限制。
2. 同一集合的全部查询和维护始终指向同一个解析后的决策根目录。
3. 根目录只保留 `decision-index.json` 和主题目录，不建立物理归档目录。
4. 主题目录使用 kebab-case 名词或名词短语，只用于稳定分类，不表示实现 owner、日期、阶段、版本或工单。
5. 文件名使用稳定的 kebab-case slug；新路径选择简短语义名称，不把日期、状态或一次性动作写入身份。
6. 相对决策根目录的 Markdown 路径是稳定身份。路径进入 Git `HEAD` 后，不因状态、关系、标题润色或 owner 调整而移动或重命名。
7. 归档记录保留在原主题目录；归档只改变 Markdown frontmatter。

## Markdown 格式

合法记录必须从严格 YAML frontmatter 开始。Frontmatter 只包含以下八个字段并保持所示顺序；正文紧随其后，不再重复标题、摘要或关系：

```markdown
---
title: <标题>
status: active
alignment: aligned
createdAt: 2026-07-22T10:20:30+08:00
purpose: <足以判断期望结果的精简目的>
background: <足以判断是否相关的精简背景>
decision: <完整表达采用方向的精简决策>
relations:
  - type: 修订
    target: workflow-policy/previous-decision.md
---

## 目的
- <希望长期达成或维护的结果>

## 背景
- <促成选择的事实、问题与关键约束>

## 决策
- 采用: <最终方向及核心理由>
```

### Frontmatter

1. `status` 只能是 `active` 或 `archived`。
2. 活动记录的 `alignment` 只能是 `aligned` 或 `unaligned`；归档记录的 `alignment` 必须是 YAML `null`。
3. `createdAt` 是首次激活时写入的不可变时间，使用带显式时区、不含小数秒的 RFC 3339 时间戳。
4. 可以同时准备多条首次激活文件；每条都使用合法的新决策身份路径、`status: active`、与后续 `activate --alignment` 一致的对齐状态和 `createdAt: null`，并满足完整正文结构。它们是未激活决策候选，不是合法集合成员。
5. 未激活候选必须尚未进入索引和 Git `HEAD`。`activate` 只把显式目标的 `createdAt: null` 替换为当前秒级时间并登记该记录；其余候选保持不变。
6. 不满足未激活候选全部条件的 `createdAt: null` 始终无效；CLI 不从文件时间、文件名、索引或默认值补写它。
7. Frontmatter 固定使用 `title`、`status`、`alignment`、`createdAt`、`purpose`、`background`、`decision`、`relations` 的顺序；关系对象固定使用 `type`、`target` 的顺序。状态命令保留投影内容并按该顺序写回完整 frontmatter；手工编辑也必须满足相同字段集合、类型和状态组合。
8. `relations` 必须是数组；没有直接前序时写作 `relations: []`，有关系时每项只包含 `type` 和决策根目录相对 `target`。

### 正文与投影

1. 标题只写在 frontmatter 的 `title`，不写日期前缀；正文不再使用一级标题。
2. 正文必需二级章节按顺序且仅为 `目的`、`背景` 和 `决策`；关系只写在 frontmatter。
3. Frontmatter 的 `purpose`、`background` 和 `decision` 是三项索引摘要；三者由作者明确概括，CLI 不从完整章节猜测摘要。
4. 标题和三个摘要字段分别为 4 至 100 个 Unicode 码点的单行文本。完整章节不受该长度限制，但必须有实际内容。
5. 摘要不得引入对应完整章节没有表达的独立含义；影响相关性、目标状态或采用方向的限定必须同时进入完整章节和摘要。
6. `决策` 至少包含一个非空 `采用`；关键备选确实有助于回放时可以增加 `不采用`。
7. Markdown 路径进入 `HEAD` 后，原地修改只承接不改变目的、范围、关键背景、采用方向、核心理由或关系语义的编辑性修正。语义改变时创建新记录并表达真实演进关系。
8. 路径尚未进入 `HEAD` 的记录可以在首次提交前原地收敛；不再成立时使用 `discard`，不为中间版本制造演进历史。

### 决策正文与对齐判断

1. `aligned` 和 `unaligned` 使用完全相同的正文结构；对齐状态只写在 frontmatter，不建立专门的差距、过渡或完成条件章节。
2. `决策` 直接写完整采用方向。任何必须长期遵守的限制、允许范围或例外也必须写在决策正文中，不能依赖对齐状态补充或放宽含义。
3. 当前实现、行为 owner 和事实不复制进决策记录。需要判断对齐时，将完整决策与实际 owner 和事实比较；差异由比较结果得出，不作为第二份状态内容保存。
4. `unaligned` 不表示决策尚未生效、不要求实施已经开始，也不自动授予或取消操作、实现或抽象空间。

## 生命周期与对齐语义

| `status` | `alignment` | 含义 |
| --- | --- | --- |
| `active` | `aligned` | 决策已经生效，完整目标已通过实际行为 owner 和事实核对并建立为必须持续遵守的当前基线。 |
| `active` | `unaligned` | 决策已经生效，但完整目标尚未核对并建立为当前基线；实际差距仍需比较完整决策、行为 owner 和事实。 |
| `archived` | `null` | 决策不再作为后续工作的当前依据，只用于历史恢复和审计。 |

1. 对齐状态表达完整决策是否已通过实际行为 owner 和事实核对并建立为当前基线，是从 `unaligned` 到 `aligned` 的单向治理状态，不是 CLI 自动计算或持续同步的实时事实镜像。
2. 当前差距从完整决策与实际 owner 和事实的比较中得出，不记录任务、日志、完成比例或差距正文。
3. `aligned` 决策发生事实偏离时属于一致性问题，不把原记录改回 `unaligned`。新的未来方向由新决策表达。
4. 生命周期和对齐状态只由 Markdown frontmatter 表达；关系不隐式改变任何状态。

## JSON 全生命周期索引

`decision-index.json` 固定使用：

```json
{
  "schemaVersion": 1,
  "namespace": "decisions",
  "definitionVersion": 2,
  "sourceRevision": "sha256:<64 lowercase hexadecimal characters>",
  "keyDefinitions": [
    { "name": "topic", "mode": "exact" },
    { "name": "status", "mode": "exact" },
    { "name": "alignment", "mode": "exact" }
  ],
  "entries": [
    {
      "id": "workflow-policy/use-explicit-approval-gate.md",
      "keys": {
        "topic": ["workflow-policy"],
        "status": ["active"],
        "alignment": ["unaligned"]
      },
      "state": {
        "path": "workflow-policy/use-explicit-approval-gate.md",
        "title": "采用显式审批门禁",
        "status": "active",
        "alignment": "unaligned",
        "createdAt": "2026-07-22T10:20:30+08:00",
        "purpose": "让高风险操作在执行前经过一致、可审计的确认。",
        "background": "审批边界分散在多个入口，后续维护容易产生不一致。",
        "decision": "使用统一的显式审批门禁，并显式记录尚未覆盖的入口。",
        "relations": []
      }
    }
  ]
}
```

1. `entries` 投影全部已建立的活动和归档 Markdown；索引与已建立 Markdown 必须一一对应。未激活候选不进入索引。
2. 每条 `state` 是领域完整投影：`path` 来自文件位置，其他字段来自 frontmatter。Markdown 仍是唯一事实源；索引不拥有或补写时间、生命周期、对齐状态、标题、摘要或关系。
3. `id` 由 `state.path` 产生。`keys` 只由 state 确定性派生：`status`、`alignment` 和 `topic` 用于当前列表筛选；归档记录没有 alignment key。只有实际命令或公共 API 需要新的查询能力时才增加 key，并同步调整领域定义版本、Schema、固定契约和测试。
4. CLI 读取索引时重新校验领域 state，包含字段集合、路径、秒级时间、生命周期与对齐组合、摘要长度和重复关系；随后从已校验 state 重新产生 id 与全部 keys，并与索引保存值核对。领域结构或 key 契约变化时提升 `definitionVersion`。
5. 领域读取器从同一批已登记 Markdown 文本同时产生完整 state 与 `sourceRevision`；通用同步在写入前再次读取 revision，源在两次读取之间变化时拒绝写入。`sourceRevision` 对 POSIX 路径和完整 UTF-8 文本进行稳定 framing 后计算 SHA-256，计算前只把 CRLF 规范化为 LF，避免 Git 跨平台 checkout 产生虚假漂移。除此之外，任何已登记文件内容变化、缺失或路径变化都会使查询拒绝陈旧索引；它不是生命周期时间，也不进入领域 state。
6. JSON 外壳固定使用 `schemaVersion`、`namespace`、`definitionVersion`、`sourceRevision`、`keyDefinitions`、`entries` 的语义顺序；key 定义及每条 `keys` 固定使用 `topic`、`status`、`alignment`，对象字段固定使用 `name`、`mode`；每条 `state` 固定使用 `path`、`title`、`status`、`alignment`、`createdAt`、`purpose`、`background`、`decision`、`relations`；关系对象固定使用 `type`、`target`。归档条目的 `keys` 省略 `alignment`，但 `state.alignment` 保留 `null`。条目仍按 `id` 字典序输出，key 值仍按固定全序输出，关系数组保持作者顺序；关系图不参与默认排序。JSON 使用 UTF-8、两空格缩进和文件末尾换行；同步检查把 Git checkout 可能产生的 CRLF 与规范 LF 视为等价。
7. 正常维护不直接编辑索引。索引有效时，`sync-index --write` 只同步已有成员的完整 state、派生 keys 和 revision，不自动吸收带非空 `createdAt` 的未登记 Markdown；索引缺失或损坏时，才从全部非候选且有效的当前格式 Markdown 恢复完整索引。未激活候选始终保持在索引外并通过 warning 列出。
8. 随包 `decision-index.schema.json` 校验通用外壳、领域 state、key 定义、枚举、路径和基础格式；state 与 Markdown 一一对应、revision、新旧投影、id、keys、排序和关系图由 CLI `check` 校验。
9. `list` 和 `trace` 发现目录成员后读取索引、校验领域 state 与派生键，并读取已登记文件的原文计算当前 revision；revision 一致时直接查询 keys 和 state，不重新解析每份 Markdown。`show` 在相同新鲜度检查通过后只读取目标原文。严格 `check`、同步和写事务仍完整解析领域 Markdown。

## 关系

新判断改变已有已建立记录时，在 frontmatter 的 `relations` 中使用决策根目录相对路径：

```yaml
relations:
  - type: 修订
    target: topic/direct-predecessor.md
  - type: 替代
    target: another-topic/replaced-decision.md
```

1. `修订` 保留前序主体方向并改变一部分；`替代` 用完整新判断取代前序；`判定无效` 表明前序依据不成立；`归并` 把分散前序整合为可独立使用的当前结论。
2. 关系只从新记录指向直接前序。`target` 必须是相对决策根目录的 POSIX Markdown 路径；目标必须已经归档、路径存在于当前 `HEAD`，且不能指向自身、重复或形成环。
3. 活动记录必须独立表达完整当前判断，不要求读者与前序拼接。
4. 关系不改变 `status` 或 `alignment`；归档、激活和对齐变化分别由显式命令完成。

## Git `HEAD` 与 pending

1. CLI 始终读取解析后的决策根目录中的 Markdown 和索引，并用一次批量 Git 树查询取得该目录在 `HEAD` 中的全部 Markdown 路径。
2. 当前文件路径不在 `HEAD` 时，查询临时显示 `pending`；它不是持久状态，不写入 Markdown、索引、缓存或隐藏文件，`git add` 也不会改变判断。
3. 已建立路径从工作区消失是严格错误；CLI 不根据内容、diff 或相似度推断重命名。
4. 所有关系目标都必须位于 `HEAD`；pending 记录不能充当前序。
5. 未激活候选与 pending 不同：候选尚未生效且不在索引中，pending 已经激活并生效。候选路径一旦进入 `HEAD` 仍保留 `createdAt: null`，即视为阻断性损坏，不能再按新候选激活。

## 维护事务

1. `sync-index --write` 先校验全部 Markdown 与 Git 边界。索引有效时只重建已有成员投影，普通未登记 Markdown 仍阻断；索引缺失或损坏时从全部非候选有效 Markdown 恢复完整索引。合格的未激活候选不进入索引，也不阻断同步，但命令必须逐条 warning。其他错误仍使同步失败并恢复原索引。
2. 状态命令先构建目标 Markdown，写入目标文件，再从已建立记录生成候选索引并校验完整事务。其他合格未激活候选只豁免“尚未激活且未进入索引”这一项诊断；其正文、身份、关系和 `HEAD` 边界仍必须有效。
3. 写命令成功且仍有未激活候选时退出码保持 `0`，stderr 逐条列出剩余路径，并明确严格 `check` 在候选清空前继续失败。
4. 任一步出现候选豁免以外的错误时，同时恢复本次命令修改的全部目标 Markdown 和原索引。
5. 写命令不承诺进程或系统中断级原子性；Git 历史承接异常恢复。正常失败必须恢复本次命令已写入的文件组合。

### 首次激活或重新激活

1. 可以先写好多条严格候选 Markdown；每条使用 `status: active`、后续命令对应的 `alignment`、`createdAt: null` 和完整正文，且路径尚未进入 `HEAD`。
2. 运行 `activate <path> --alignment aligned|unaligned`。命令仍只接受一个目标；首次激活写入当前秒级 `createdAt` 并只登记该目标，重新激活归档记录时保留原时间。
3. 完整决策已经与实际行为 owner 和事实核对满足并应建立为当前基线时使用 `--alignment aligned`；尚未完成该核对时使用 `--alignment unaligned`。
4. 两种对齐状态使用同一正文结构，`activate` 不从正文推断或补写对齐状态。
5. 当前目标激活成功后，其他候选继续保持未激活并按路径 warning；全部候选激活或丢弃后，严格 `check` 才能通过。
6. 活动记录使用相同对齐参数再次激活是无变化成功；活动记录的对齐状态不能通过 `activate` 改变。即使没有状态变化，仍须提醒其他未激活候选。

### 标记已对齐

1. 调用前由人类或 agent 将完整决策与当前行为 owner 和事实比较，确认已经满足决策要求并应建立为当前基线。
2. `mark-aligned <path>` 只允许 `active + unaligned` 变为 `active + aligned`，保留 `createdAt` 和正文。
3. CLI 写入状态不是实施行为或实时监控；没有满足条件时不得用命令掩盖差距。

### 归档、演进与丢弃

1. `archive <path...>` 只接受已经位于 `HEAD` 的活动记录，把 `status` 改为 `archived`、`alignment` 改为 `null`，不改变其他记录或关系。
2. 修订、替代、判定无效或归并时，先归档全部直接前序，再写完整新记录并激活；关系不代替状态命令。
3. `discard <path>` 只删除不在 `HEAD` 且没有其他记录引用的目标 Markdown；目标可以是未激活候选或已激活的 pending 记录，后者同时从重建索引中移除。命令不修改 Git 暂存区。

## CLI

`scripts/decision-records.mjs` 提供：

1. `check`：严格检查当前格式 Markdown、frontmatter 状态组合、正文、索引、关系和 Git `HEAD` 边界；任一未激活候选存在都使检查失败。
2. `list [--topic <topic-id>] [--status active|archived|all] [--alignment aligned|unaligned|all] [--full-time]`：默认列出全部活动记录和两种对齐状态；筛选项可以组合。
3. `show <path>`：先输出路径、生命周期、对齐状态、创建时间和临时 pending，再输出原始 Markdown。
4. `trace <path> [--direction predecessors|successors|both] [--depth <n>]`：追溯直接关系图，并同时显示生命周期和对齐状态。
5. `sync-index [--write]`：索引有效时比较或重建已有成员投影，索引缺失或损坏时从全部非候选有效 Markdown 恢复完整索引，并 warning 仍在索引外的未激活候选。
6. `activate <path> --alignment aligned|unaligned`：首次激活或重新激活，并显式指定活动对齐状态；首次激活只登记目标并 warning 其他候选。
7. `mark-aligned <path>`：只完成活动未对齐到活动已对齐的变化。
8. `archive <path...>`：归档指定活动记录并清空对齐状态。
9. `discard <path>`：丢弃尚未进入 `HEAD` 的记录。

查询命令只在索引能够按当前通用 schema 与决策领域定义解析，且 `sourceRevision` 与全部已登记 Markdown 当前原文一致时返回结果。已登记原文发生任何变化时查询退出 `1`，不会返回可能陈旧的 state 或关系；先审阅变化并运行严格检查或 `sync-index --write`。未激活候选和其他未登记 Markdown 不进入查询结果，通过 stderr warning 暴露；已登记但尚未进入 `HEAD` 的结果附加 `[pending]`。查询或作用域维护带 warning 时退出码可以是 `0`，不代表严格集合有效。索引缺失、无法解析、revision 失配、目标未登记、Git 不可用、`HEAD` 查询失败或候选豁免以外的维护错误使对应命令退出 `1`。非法参数退出码为 `2`。

严格 `check` 验证：

1. 决策根目录、根文件、主题目录和文件路径。
2. frontmatter 字段、类型、状态组合与秒级时间。
3. Frontmatter 标题、摘要与关系，完整章节、章节顺序和投影长度。
4. 通用 schema v1、决策定义版本、revision、路径唯一性与排序、已建立 Markdown 和索引一一对应、state 与派生 keys 一致性，以及未激活候选保持在索引外。
5. 关系目标路径、归档目标、`HEAD` 成员、重复、自环和环路。
6. 已建立路径没有从工作区消失，pending 只作为临时查询标记，未激活候选尚未进入 `HEAD`。
7. 未激活候选已经全部激活或丢弃；候选存在本身就是严格失败，不因作用域维护曾经成功而降级。

摘要与完整章节的语义一致性、记录门槛、理由质量、完整决策是否已与当前 owner 和事实核对并建立为基线、必须遵守的限制是否进入决策正文、隐私和关系是否确为直接前序，由 agent 与用户完成语义检查。
