# 调查资源诊断

本文维护 CLI 资源信号、策略字段及覆盖含义。资料取舍见[资源选择与示例](resource-selection.md)；路径、owner、共享与事实忠实要求由[固定契约](investigation-report-contract.md#资源引用与归属)维护。

## 使用与结果判读

`candidates`、`show-candidate`、`publish`（含预检）及成功的 `check` 默认返回 `resourceReview`。检查既有报告直接使用 `check`：全量检查覆盖全部正式报告，局部检查覆盖所选报告。诊断只读且非阻断；readiness、发布资格和索引新鲜度由领域检查决定，配置错误在业务操作前失败。

1. 先看 `enabled`、`complete` 和 `skippedFiles`，确认本次覆盖。
2. 再看 `summary` 分类汇总，按 `findings` 定位材料，对照正文依赖裁剪信息与形式，优先概括必要结果，再决定是否保留片段或原形式。
3. stderr 提供总量、已接受及待处理数量、覆盖提示和优先级最高的至多 12 条未接受明细；普通格式化 JSON 与 `--json` 均完整返回本次 findings，其余终端明细引导至 `resourceReview.findings`，不重复输出。

findings 优先呈现覆盖不足，其余 warn 先于 info；同级按确定副本、体积／数量、类型、可压缩性排序，再按 code、路径和消息稳定排序。读取预算与文件数上限限制扫描工作量，覆盖不足通过结果字段表达，与输出截断不同。

## 信号与复核动作

| finding code | 默认提示与复核动作 |
| --- | --- |
| `resource-file-bytes` | 单文件大于 1 MiB；复核是否需要完整材料。 |
| `resource-report-bytes` | 报告直接引用的资源已知合计大于 10 MiB；从 files 定位主要贡献文件。 |
| `resource-report-count` | 直接引用超过 30 项，info 提示是否适合整合。 |
| `resource-high-compressibility` | 压缩后比例达到大小分档提示线；复核内部重复信息及其证据用途。 |
| `resource-exact-duplicates` | 不同路径的非空文件经完整 SHA-256 分组、逐字节确认相等；列出副本组及冗余体积。 |
| `resource-content-type` | `infer` 识别格式，`content_inspector` 辅助判断文本倾向；复核非文本材料的阅读用途。 |

图片、音视频和 PDF 默认 info；归档、可执行及其他非文本类型默认 warn。未匹配格式且有二进制特征时标为 `suspected-binary`；仅 UTF-8 解码失败标为 `unknown-text-encoding`，info 提示。类型观察最多使用开头 8 KiB，属于启发识别，非完整格式或编码验证。

压缩后比例是压缩字节数／参与压缩的原始字节数，用作**内部重复信息的启发信号**，不是语义重复率或删除依据。按[资源选择与示例](resource-selection.md)判断逐次条件、顺序、异常和差异是否为正文所需，具体整理服从资源契约和当前授权。没有 finding 仅表示当前策略与覆盖下未触发信号，不能证明材料必要、无语义重复或安全。

## 检查范围与成本

一次检查以单源为界；按 key 逐源执行时，各源独立生成 `resourceReview`，各自计算预算与资源 ID 去重。结果回读见 [CLI 逐源结果](cli-operations.md#逐源结果与回读)。

检查对象是返回的候选、预计／实际发布候选，或 `check` 所选正式报告的**直接资源引用**。同源共享的同一资源 ID 只检查一次；未引用文件、未选报告及其余资源池不纳入范围。

1. **先取得基础观察。** 按资源 ID 稳定排序，在 `maxFiles` 内通过不跟随符号链接的路径分量取得普通文件大小，再在共享预算内读取各文件最多 8 KiB 的头部并识别类型。路径或版本控制可见性检查失败的候选引用仅记未完成，诊断不打开其载荷。
2. **再使用剩余预算深入检查。** 文本按大小分档做压缩观察；相同大小的非空文件按需读取全文，复用于类型、压缩和副本比较。非文本且无需完整副本比较时只保留头部观察。后续读取复用头部，小文件已有完整内容时直接复用，避免重复计费或读取；完整内容最多在本次读取预算内保留。
3. **如实保留覆盖缺口。** 预算耗尽、文件数超限、读取失败或观察到大小漂移时记未完成，并保留已取得的大小与类型。可按报告局部重跑或调整预算。元数据与内容分别取得，结果不是跨文件原子快照。

默认 64 KiB–1 MiB 的文本候选全文压缩；更大文件取包含首尾、均匀分布的四个 256 KiB 窗口，总采样量为 1 MiB，仍受共享读取预算约束。有效窗口数至多等于文件字节数，宽度至多为文件大小除以有效窗口数的整数商，保证不重叠；自定义上限过大时实际采样量随之缩减。各窗口独立以 zstd level 1 压缩，按样本总字节汇总比例。**采样相等不确认副本**，副本确认需要完整字节。

发布预检表达预计发布时的观察，正式发布诊断使用本次准备结果；调用结束后文件仍可能变化。

## 结果字段

| 结果字段 | 读取方式 |
| --- | --- |
| `enabled`、`scope` | 是否启用；scope 固定为 `selected-report-references`。 |
| `complete` | 声明范围内的计划检查是否完成；按计划抽样可为 true，关闭时为 false。 |
| `resourceCount` | 去重后的直接资源数量。 |
| `reports[].knownBytes`、`metadataComplete` | 已取得大小的合计；后者为 false 时，总量只是已知部分。 |
| `readBudgetUsedBytes`、`skippedFiles` | 预留的最大读取量、未完成文件检查数；读取失败时实际读取可更少。 |
| `files` | 大小、类型、`duplicateCheck`，及适用时的 `compressibility`：算法、全文／采样 method、输入与压缩字节、比例、阈值。 |
| `duplicateGroups` | 本次已逐字节确认的副本组；是否合并仍需按来源与用途判断。 |
| `summary` | 全部 finding 的 `warnings`、`info` 及 `byCode` 分类计数，`accepted` 是其中已接受的数量；关闭的规则不计入，派生的覆盖提示单独表达。 |
| `findings`、`omittedFindings` | 完整返回本次实际产生的全部明细及 `accepted`；已接受项另含 `acceptanceReason`。不设输出条数上限，`omittedFindings` 为 0。 |

## 配置

配置发现与合并见[来源配置与帮助](source-selection.md#配置发现与合并)。`resources` 与 `sources` 同文件，按需覆盖，例如：

```json
{
  "version": 1,
  "resources": {
    "fileBytesWarn": 2097152,
    "readBudgetBytes": 67108864,
    "binary": { "media": "off" }
  }
}
```

下表字段均位于 `resources`；字节采用实际字节，1 KiB = 1024 bytes。大小与数量超过阈值才提示。

| 字段 | 默认值 | 允许值或含义 |
| --- | --- | --- |
| `enabled` | `true` | 布尔值；关闭时仍返回覆盖状态。 |
| `fileBytesWarn`、`reportBytesWarn` | 1 MiB、10 MiB | 正整数字节数。 |
| `reportFilesWarn` | 30 | 正整数。 |
| `readBudgetBytes` | 32 MiB | 单次共享读取预算，1 byte–256 MiB。 |
| `maxFiles` | 1024 | 单次检查文件上限，1–10,000。 |
| `exactDuplicates` | `warn` | `off` / `info` / `warn`。 |
| `binary.media` | `info` | `off` / `info` / `warn`。 |
| `binary.archive`、`binary.executable`、`binary.unknown` | `warn` | `off` / `info` / `warn`。 |
| `compressibility.enabled` | `true` | 布尔值。 |
| `compressibility.fullFileBytes` | 1 MiB | 全文压缩上限，1 byte–16 MiB。 |
| `compressibility.sampleWindowBytes` | 256 KiB | 单窗口大小上限，1 byte–1 MiB。 |
| `compressibility.sampleWindows` | 4 | 均匀分布窗口数上限，2–16。 |
| `compressibility.bands` | 见下表 | 非空数组，整体替换；按 `minBytes` 严格递增。 |

对文件取不大于其大小的最后一档，比例小于或等于 `maxCompressedRatio` 时提示。各档 `minBytes` 为正整数，比例须处于 `(0, 1]`。默认小于 64 KiB 不做内部重复性启发检查，其他检查照常。

| `minBytes` | `maxCompressedRatio` |
| --- | --- |
| 65536（64 KiB） | 0.10 |
| 262144（256 KiB） | 0.15 |
| 1048576（1 MiB） | 0.20 |

## 复核后的持久接受

已复核且决定保留的信号，由维护者手动写入调用工作区配置的 `resources.acceptances`。记录持续有效，直至显式移除；资源内容或体积变化本身不会使记录失效，每次检查仍观察当前资源。

以下示例位于调用工作区的项目配置 `.investigation-report.json`：

```json
{
  "resources": {
    "acceptances": [
      {
        "source": { "root": ".", "investigationsDir": "docs/investigations" },
        "code": "resource-file-bytes",
        "target": "report-id/evidence.txt",
        "reason": "正文需逐项核对差异，概括无法承接所需依据"
      },
      {
        "source": { "root": ".", "investigationsDir": "docs/investigations" },
        "code": "resource-exact-duplicates",
        "members": ["report-a/evidence.txt", "report-b/evidence.txt"],
        "reason": "正文比较两份样本的目录布局，需在各自位置保留该文件"
      }
    ]
  }
}
```

| 字段 | 定位与约束 |
| --- | --- |
| `source` | `root` 相对定义该项的配置文件目录解析，与根内相对路径 `investigationsDir` 共同确定实际来源；身份比较沿用[来源身份与执行路径](source-selection.md#来源身份与执行路径)，与 key 名称无关。 |
| `code` | 仅接受上表六种资源信号；读取失败、预算不足及其他覆盖缺口仍独立报告。 |
| `target` | 报告体积／数量信号使用 [Investigation ID](investigation-report-contract.md#身份与集合)，其余非副本信号使用 [resource ID](investigation-report-contract.md#路径与文件要求)；与 `members` 互斥。 |
| `members` | 副本组的全部资源 ID，按字典序严格递增、无重复，与本次检测的完整组相同。 |
| `reason` | 非空复核理由，在已接受 finding 的 `acceptanceReason` 中回读。 |

接受数组按配置层整体替换，本地配置可用 `[]` 清空继承的接受项。同一来源、规则和对象有多条记录时，采用第一条理由。

接受仅改变提示处置，原始观察、完整 findings 和覆盖状态继续保留；readiness 与发布资格仍由领域检查决定。
