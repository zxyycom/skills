# 决策记录契约

本文件是 `decision-records` 的唯一固定契约，只承接精确存储、状态语义、维护事务和 CLI 行为。触发、语义恢复、偏离判断、候选确认和按任务出口交付由 `SKILL.md` 承接。本文将保存索引和 Markdown 的目录称为“决策根目录”。未传 `--decisions-dir` 时使用 `<root>/docs/decisions`；显式传入时，绝对路径直接作为目标，非绝对路径只相对 `--root` 解析。目标可以位于 `--root` 外部。

CLI 只接受本契约定义的当前领域目录表和 Markdown 格式，以及 `schemaVersion: 2`、`namespace: decisions`、`definitionVersion: 3`、包含完整 `metadata.domains` 的当前通用索引，不推断缺失 metadata。决策根目录可以位于普通文件系统目录或 Git 工作区；版本管理状态不参与候选、建立、生命周期、关系或索引成员判断。

## Owner 与内容边界

1. 每条已建立决策 Markdown 是自身状态和语义的唯一事实源，承接 `status`、`alignment`、`createdAt`、标题、索引摘要、完整目的、背景、决策和直接关系；所在领域目录是其唯一领域归属。
2. 未激活决策候选只承接准备激活的完整判断和 `createdAt: null` 元数据；它不是已建立决策、没有生效，也不形成另一套持久状态。
3. `<decision-root>/decision-domains.json` 是当前集合的受控领域目录表，定义允许使用的领域及其责任边界；它不保存决策状态。
4. `<decision-root>/decision-index.json` 是从全部已建立且有效的 Markdown 确定性生成的全生命周期查询投影，不拥有独立状态；删除后可以无损重建。
5. 代码、配置、规范和项目文档承接当前事实与行为；决策记录承接已经生效的长期方向、形成判断的背景、目标状态，以及必须长期遵守的限制、允许范围或例外。
6. CLI 承接领域目录表校验、Markdown 元数据变化、索引重建、确定性检查和带诊断的查询，不保存缓存或隐藏状态。
7. 决策记录不保存任务清单、进度百分比、执行日志、完整对话、提交摘要、密钥、令牌、敏感个人信息或无助于后续判断的本机信息。

## 目录与稳定身份

```text
<decision-root>/
├── decision-domains.json
├── decision-index.json
└── <domain-id>/
    └── <semantic-slug>.md
```

1. `--root` 默认是当前工作目录，只作为默认决策根目录和相对 `--decisions-dir` 的解析基准；显式绝对 `--decisions-dir` 不受其目录边界限制。
2. 同一集合的全部查询和维护始终指向同一个解析后的决策根目录。
3. 根目录只保留 `decision-domains.json`、`decision-index.json` 和已定义的领域目录，不建立物理归档目录。
4. 每个一级目录名必须等于目录表中的一个 `domain` ID；每条 Markdown 必须直接位于一个领域目录下。未知目录、嵌套目录、领域目录中的非 Markdown 文件，以及已经存在但为空的领域目录均无效。目录表可以定义暂时没有记录的领域，此时不创建对应空目录。
5. 文件名使用稳定的 kebab-case slug；新路径选择简短语义名称，不把日期、状态或一次性动作写入身份。
6. 相对决策根目录的 `<domain-id>/<semantic-slug>.md` 是稳定身份，第一段同时是唯一领域分类。日常生命周期、关系或标题润色不移动已建立记录；领域纠正或明确结构迁移必须协调更新路径、全部关系、仓库内直接引用和派生索引。
7. 归档记录保留在所属领域目录；归档只改变 Markdown frontmatter。

## 受控决策领域

1. `decision-domains.json` 固定使用 `schemaVersion: 1` 和按 `id` 升序排列的非空 `domains` 数组；每项只包含 kebab-case `id` 和 4 至 200 个 Unicode 码点的单行 `description`。领域 ID 必须唯一，描述必须清楚界定一个可长期维护的责任或能力边界。
2. 每条记录只属于路径第一段指定的一个目录表 `domain`。它回答“这条决策主要改变哪个稳定责任边界的契约”，不按正文中出现的名词、执行阶段或所有受影响对象归类。
3. 一条判断触及多个领域时，选择拥有被改变契约的主要领域；不同部分若可以被独立修订、替代或退役，则拆成多条决策。其他影响写入正文，不建立自由 tag 或 `impact` 字段；只有出现实际结构化查询需求时才扩展受控查询维度。
4. 领域归类错误且决策语义本身未变时，将记录移动到正确领域目录，并协调更新关系、直接引用和索引；若责任边界或采用方向本身变化，则按决策演进创建新记录。领域目录表的结构性拆分、归并或重命名达到长期维护门槛时另行记录决策。

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
    target: workflow-governance/previous-decision.md
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
4. 可以同时准备多条首次激活文件；每条都使用已定义领域下的合法新身份路径、`status: active`、与后续 `activate --alignment` 一致的对齐状态和 `createdAt: null`，并满足完整正文结构。它们是未激活决策候选，不是合法集合成员。
5. 未激活候选不进入索引。`activate` 只把显式目标的 `createdAt: null` 替换为当前秒级时间，使它成为已建立记录；其余候选保持不变，索引从当前全部已建立记录完整重建。
6. 不满足未激活候选全部条件的 `createdAt: null` 始终无效；CLI 不从文件时间、文件名、索引或默认值补写它。
7. Frontmatter 固定使用 `title`、`status`、`alignment`、`createdAt`、`purpose`、`background`、`decision`、`relations` 的顺序；不接受 `domain` 或其他额外字段。关系对象固定使用 `type`、`target` 的顺序。状态命令保留投影内容并按该顺序写回完整 frontmatter；手工编辑也必须满足相同字段集合、类型和状态组合。
8. `relations` 必须是数组；没有直接前序时写作 `relations: []`，有关系时每项只包含 `type` 和决策根目录相对 `target`。

### 正文与投影

1. 标题只写在 frontmatter 的 `title`，不写日期前缀；正文不再使用一级标题。
2. 正文必需二级章节按顺序且仅为 `目的`、`背景` 和 `决策`；关系只写在 frontmatter。
3. Frontmatter 的 `purpose`、`background` 和 `decision` 是三项索引摘要；三者由作者明确概括，CLI 不从完整章节猜测摘要。
4. 标题和三个摘要字段分别为 4 至 100 个 Unicode 码点的单行文本。完整章节不受该长度限制，但必须有实际内容。
5. 摘要不得引入对应完整章节没有表达的独立含义；影响相关性、目标状态或采用方向的限定必须同时进入完整章节和摘要。
6. `决策` 至少包含一个非空 `采用`；关键备选确实有助于回放时可以增加 `不采用`。
7. 非空 `createdAt` 的已建立记录原地修改只承接不改变目的、范围、关键背景、采用方向、核心理由或关系语义的编辑性修正。语义改变时创建新记录并表达真实演进关系。
8. `createdAt: null` 的完整候选可以在首次激活前原地收敛；不再成立时使用 `discard`，不为中间版本制造演进历史。无效未登记文件和任意已建立记录都不能通过 `discard` 删除。

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
  "schemaVersion": 2,
  "namespace": "decisions",
  "definitionVersion": 3,
  "metadata": {
    "domains": [
      {
        "id": "workflow-governance",
        "description": "维护工作流中的批准、责任和长期治理边界。"
      }
    ]
  },
  "sourceRevision": "sha256:<64 lowercase hexadecimal characters>",
  "keyDefinitions": [
    { "name": "domain", "mode": "exact" },
    { "name": "status", "mode": "exact" },
    { "name": "alignment", "mode": "exact" }
  ],
  "entries": [
    {
      "id": "workflow-governance/use-explicit-approval-gate.md",
      "keys": {
        "domain": ["workflow-governance"],
        "status": ["active"],
        "alignment": ["unaligned"]
      },
      "state": {
        "path": "workflow-governance/use-explicit-approval-gate.md",
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
2. 每条 `state` 是单条决策的完整索引投影：`path` 来自文件位置，其他字段来自 frontmatter。路径第一段提供领域，`state` 不重复保存 `domain`；索引不拥有或补写领域、时间、生命周期、对齐状态、标题、摘要或关系。
3. `id` 由 `state.path` 产生。`keys` 只确定性派生：`domain` 来自 `state.path` 第一段并必须存在于已校验的 `metadata.domains`，`status` 和 `alignment` 来自 state；归档记录没有 alignment key。只有实际命令或公共 API 需要新的查询能力时才增加 key，并同步调整领域定义版本、Schema、固定契约和测试。
4. CLI 读取索引时先把 `metadata.domains` 解析为完整领域目录，再逐条校验 state 的字段集合、路径领域、秒级时间、生命周期与对齐组合、摘要长度和重复关系；随后重新产生 id 与全部 keys，并与索引保存值核对。`state` 结构或 key 契约变化时提升 `definitionVersion`。
5. 决策读取器从规范化领域目录表和当前全部已建立 Markdown 同时产生完整 state 与 `sourceRevision`；通用同步在写入前再次读取 revision，源在两次读取之间变化时拒绝写入。目录表按已校验对象规范化，因而仅 JSON 排版变化不产生漂移，ID、顺序或描述等语义变化会产生漂移。Markdown 对 POSIX 路径和完整 UTF-8 文本进行稳定 framing，计算前只把 CRLF 规范化为 LF。任何目录表语义变化，或已建立文件新增、内容变化、缺失、路径变化，都会使查询拒绝陈旧索引；revision 不是生命周期时间，也不进入决策 state。
6. JSON 外壳固定使用 `schemaVersion`、`namespace`、`definitionVersion`、`metadata`、`sourceRevision`、`keyDefinitions`、`entries` 的语义顺序；`metadata` 固定只包含按 ID 升序的完整 `domains` 派生副本，schema v1、缺失 metadata 或不完整领域定义的索引不兼容。key 定义及每条 `keys` 固定使用 `domain`、`status`、`alignment`，对象字段固定使用 `name`、`mode`；每条 `state` 固定使用 `path`、`title`、`status`、`alignment`、`createdAt`、`purpose`、`background`、`decision`、`relations`；关系对象固定使用 `type`、`target`。归档条目的 `keys` 省略 `alignment`，但 `state.alignment` 保留 `null`。条目按 `id` 字典序输出，key 值按固定全序输出，关系数组保持作者顺序；关系图不参与默认排序。JSON 使用 UTF-8、两空格缩进和文件末尾换行；同步检查把 Git checkout 可能产生的 CRLF 与规范 LF 视为等价。
7. 正常维护不直接编辑索引。`sync-index --write` 无论索引有效、缺失、损坏或陈旧，都从全部合法非空 `createdAt` Markdown 重建完整 state、派生 keys 和 revision。旧索引之外新增的已建立文件是正常成员来源；未激活候选始终保持在索引外并通过 warning 列出。
8. 随包 `decision-index.schema.json` 校验通用外壳、决策索引 state、key 定义、枚举、路径和基础格式；state 与 Markdown 一一对应、revision、新旧投影、id、keys、排序和关系图由 CLI `check` 校验。
9. `decision-domains.json` 是 `metadata.domains` 的唯一来源，并参与每次结构检查、索引同步、revision 计算和查询前校验。索引中的领域 key 只从路径第一段派生；Markdown 和 state 都不保存领域字段。
10. `list`、`show` 和 `trace` 先扫描当前 Markdown，得到完整已建立路径集合并校验领域目录，再读取索引、校验 `metadata.domains`、决策 state 与派生键，并用规范化目录表和该路径集合计算当前 revision。目录表语义变化、旧索引之外出现已建立文件、旧成员消失或任一已建立原文变化时查询拒绝陈旧结果；严格 `check`、同步和写事务同样完整解析目录表与决策 Markdown。

## 关系

新判断改变已有已建立记录时，在 frontmatter 的 `relations` 中使用决策根目录相对路径：

```yaml
relations:
  - type: 修订
    target: workflow-governance/direct-predecessor.md
  - type: 替代
    target: project-tooling/replaced-decision.md
```

1. `修订` 保留前序主体方向并改变一部分；`替代` 用完整新判断取代前序；`判定无效` 表明前序依据不成立；`归并` 把分散前序整合为可独立使用的当前结论。
2. 关系只从新记录指向直接前序。`target` 必须是相对决策根目录的 POSIX Markdown 路径；目标必须是当前扫描到的已建立归档记录，且不能指向候选、自身、重复或形成环。
3. 活动记录必须独立表达完整当前判断，不要求读者与前序拼接。
4. 关系不改变 `status` 或 `alignment`；归档、激活和对齐变化分别由显式命令完成。

## Markdown 建立状态

1. 合法候选固定为合法的新身份路径、当前完整格式、`status: active`、`alignment: aligned|unaligned` 且 `createdAt: null` 的 Markdown。
2. 候选尚未建立或生效，不进入索引；严格 `check` 在任一候选存在时失败，作用域维护和同步成功时仍逐条 warning 剩余候选。
3. 合法非空 `createdAt` Markdown 是已建立记录。活动已建立记录立即生效；归档已建立记录只用于历史恢复和关系前序。
4. 当前全部已建立 Markdown 决定索引成员和查询新鲜度。旧索引之外出现已建立文件时，查询拒绝陈旧结果；`sync-index --write` 后该文件成为正常索引成员。
5. Git 提交、暂存、历史或仓库存在性都不参与建立状态；CLI 不输出或维护另一个临时生命周期。

## 维护事务

1. `sync-index --write` 先校验领域目录表和全部 Markdown，再从全部合法已建立记录完整重建索引。合格的未激活候选不进入索引，也不阻断同步，但命令必须逐条 warning；其他无效 Markdown 仍使同步失败并保留原索引。
2. 状态命令先构建目标 Markdown，写入目标文件，再从全部已建立记录生成索引并校验完整事务。其他合格未激活候选只豁免“尚未激活且未进入索引”这一项诊断；其正文、身份和关系仍必须有效。
3. 写命令成功且仍有未激活候选时退出码保持 `0`，stderr 逐条列出剩余路径，并明确严格 `check` 在候选清空前继续失败。
4. 任一步出现候选豁免以外的错误时，同时恢复本次命令修改的全部目标 Markdown 和原索引。
5. 写命令不承诺进程或系统中断级原子性；Git 历史承接异常恢复。正常失败必须恢复本次命令已写入的文件组合。

### 首次激活或重新激活

1. 首次初始化集合时先建立合法 `decision-domains.json`；随后可以在已定义领域目录下写好多条严格候选 Markdown，每条使用合法的新身份路径、`status: active`、后续命令对应的 `alignment`、`createdAt: null` 和完整正文。
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

1. `archive <path...>` 接受任意活动已建立记录，把 `status` 改为 `archived`、`alignment` 改为 `null`，不改变 `createdAt`、其他记录或关系；旧索引缺失、损坏或未拥有目标成员时仍从 Markdown 完成维护并重建完整索引。
2. 修订、替代、判定无效或归并时，先归档全部直接前序，再写完整新记录并激活；关系不代替状态命令。
3. `discard <path>` 只删除没有其他记录引用的完整合法未激活候选。无效未登记文件和任意已建立记录都拒绝并原样保留；删除最后一条 Markdown 时保留领域目录表，避免隐式丢失集合分类契约。

## CLI

`scripts/decision-records.mjs` 提供：

1. `check`：严格检查领域目录表、当前格式 Markdown、frontmatter 状态组合、正文、索引和关系；任一未激活候选存在都使检查失败。
2. `domains`：只读取并按 ID 升序输出完整领域目录；索引缺失或陈旧不阻断该命令。
3. `list [--domain <domain-id>] [--status active|archived|all] [--alignment aligned|unaligned|all] [--full-time]`：默认列出全部活动记录和两种对齐状态；`--domain` 至多出现一次，再与其他筛选条件组合。未定义领域和重复参数退出 `2`；已定义但没有匹配记录的领域返回空结果和退出码 `0`。输出固定包含 `Domains:` 和 `Decisions:` 两段，空段写 `- none`；决策行通过路径表达领域，不重复字段。
4. `show <path>`：先输出路径、由路径解析的领域 ID 与描述、生命周期、对齐状态和创建时间，再输出原始 Markdown。
5. `trace <path> [--direction predecessors|successors|both] [--depth <n>]`：先输出涉及的领域定义，再追溯直接关系图，并显示生命周期和对齐状态。
6. `sync-index [--write]`：从领域目录表和全部合法已建立 Markdown 比较或重建完整索引，并 warning 仍在索引外的未激活候选；有效、缺失、损坏和陈旧索引使用同一成员来源。
7. `activate <path> --alignment aligned|unaligned`：首次激活或重新激活，并显式指定活动对齐状态；首次激活只登记目标并 warning 其他候选。
8. `mark-aligned <path>`：只完成活动未对齐到活动已对齐的变化。
9. `archive <path...>`：归档指定活动记录并清空对齐状态。
10. `discard <path>`：只丢弃完整合法的未激活候选。

除 `domains` 外，查询命令只在领域目录表有效、索引能够按当前通用 schema 与决策索引定义解析，且 `sourceRevision` 与当前目录表语义及全部已建立 Markdown 的路径和原文一致时返回结果。目录表语义变化，或已建立成员新增、缺失、移动、原文变化时，查询退出 `1`，不会返回可能陈旧的 state、领域定义或关系；先审阅变化并运行严格检查或 `sync-index --write`。未激活候选和其他无效未登记 Markdown 不进入查询结果，通过 stderr warning 暴露。查询或作用域维护带 warning 时退出码可以是 `0`，不代表严格集合有效。领域目录表缺失或无效、索引缺失或无法解析、revision 失配、目标未建立或候选豁免以外的维护错误使对应命令退出 `1`。非法参数和查询未定义领域退出码为 `2`。

严格 `check` 验证：

1. 决策根目录、允许的根文件、一级领域目录和两段式文件路径；未知、空、嵌套或包含非 Markdown 文件的目录无效。
2. 领域目录表的 schema、字段、ID、描述、唯一性与顺序，以及路径第一段表达的每条记录领域成员关系；已定义无记录领域允许没有物理目录。
3. frontmatter 字段、类型、状态组合与秒级时间。
4. Frontmatter 标题、摘要与关系，不允许 `domain` 残留；并检查完整章节、章节顺序和投影长度。
5. 通用 schema v2、完整 `metadata.domains`、决策定义版本、包含目录表语义的 revision、路径唯一性与排序、已建立 Markdown 和索引一一对应、无 domain 的 state 与路径派生 keys 一致性，以及未激活候选保持在索引外；schema v1、缺失 metadata 或 metadata 不完整的索引不通过严格检查。
6. 关系目标路径、当前扫描到的已建立归档目标、重复、自环和环路。
7. 当前全部已建立 Markdown 与索引一一对应，未激活候选保持在索引外。
8. 未激活候选已经全部激活或丢弃；候选存在本身就是严格失败，不因作用域维护曾经成功而降级。

摘要与完整章节的语义一致性、记录门槛、理由质量、完整决策是否已与当前 owner 和事实核对并建立为基线、必须遵守的限制是否进入决策正文、隐私和关系是否确为直接前序，由 agent 与用户完成语义检查。
