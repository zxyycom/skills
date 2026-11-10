# 调查资源诊断

本文维护 CLI 资源信号、策略字段及覆盖含义。资料取舍按 [Skill 的资源选择](../SKILL.md#4-选择随附资源)判断；路径、owner、共享与历史保真由[固定契约](investigation-report-contract.md#资源引用与归属)维护。

## 读取与处置

`candidates`、`show-candidate`、`publish`（含预检）及成功的 `check` 默认返回 `resourceReview`。先看覆盖与 summary 分类汇总，再按 findings 定位材料，决定保留、节选、汇总或共享。诊断只读且非阻断，readiness、发布资格和索引新鲜度继续由领域检查决定；配置错误在业务操作前失败。

| finding code | 默认提示与复核动作 |
| --- | --- |
| `resource-file-bytes` | 单文件大于 1 MiB；复核是否需要完整材料。 |
| `resource-report-bytes` | 报告直接引用的资源已知合计大于 10 MiB；从 files 定位主要贡献文件。 |
| `resource-report-count` | 直接引用超过 30 项，info 提示是否适合整合。 |
| `resource-high-compressibility` | 压缩后比例达到大小分档提示线；复核内部重复信息及其证据用途。 |
| `resource-exact-duplicates` | 不同路径的非空文件经完整 SHA-256 分组、逐字节确认相等；列出副本组及冗余体积。 |
| `resource-content-type` | `infer` 识别格式，`content_inspector` 辅助判断文本倾向；复核非文本材料的阅读用途。 |

图片、音视频和 PDF 默认 info；归档、可执行及其他非文本类型默认 warn。未匹配格式且有二进制特征时标为 `suspected-binary`；仅 UTF-8 解码失败标为 `unknown-text-encoding`，info 提示。类型观察最多使用开头 8 KiB，属于启发识别，非完整格式或编码验证。

压缩后比例是压缩字节数／参与压缩的原始字节数，**不是语义重复率或删除依据**。结构化数据也可能含重复载荷；逐次条件、顺序、异常和差异仍有独立价值，可以保留观测并共享相同大载荷。工具只提供观察，资源精简与历史材料变更仍按固定契约和当前授权处理。

## 配置

配置发现、项目／本地合并和来源组见 [统一配置](cli-operations.md#统一配置)。`resources` 与 `sources` 同文件，按需覆盖，例如：

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

## 范围、预算与结果

范围是返回的候选、预计／实际发布候选，或 check 所选正式报告的**直接资源引用**。全量 check 覆盖全部正式报告；共享的同一资源 ID 在一次调用中仅检查一次。范围不扩展到未引用文件、其他报告或全集资源池。

文件按资源 ID 稳定排序；在 `maxFiles` 内通过不跟随符号链接的路径分量取得普通文件大小。先在共享预算内读取各文件最多 8 KiB 的头部并识别类型，再将剩余预算用于压缩和完整副本比较；深度检查不足时保留已取得的类型观察。候选中路径或版本控制可见性检查失败的引用仅记未完成，诊断不打开其载荷。元数据与内容分别取得，已观察到的大小漂移也记未完成；这不是跨文件原子快照。

默认 64 KiB–1 MiB 的文本候选全文压缩，更大文件取首尾及均匀分布的四个 256 KiB 窗口，总采样量为 1 MiB，仍受单次共享读取预算约束。窗口数至多等于文件字节数，宽度至多为文件大小除以有效窗口数的整数商，使各窗口不重叠；自定义上限过大时实际采样量随之缩减。各窗口独立以 zstd level 1 压缩，按样本总字节汇总比例。相同大小的文件在预算足够时读取全文，复用于类型、压缩和副本比较；**采样相等不确认副本**。

类型、压缩与副本比较共用读取预算，后续读取复用已取得的头部，不为重叠区段重复计费或读取。小文件已有完整内容时直接复用；非文本且无需完整副本比较时只保留头部观察。完整内容最多在本次预算内保留。预算耗尽、文件数超限、读取失败均保留未完成状态；可按报告局部重跑或调整预算。

| 结果字段 | 读取方式 |
| --- | --- |
| `enabled`、`scope` | 是否启用；scope 固定为 `selected-report-references`。 |
| `complete` | 声明范围内的计划检查是否完成；按计划抽样可为 true，关闭时为 false。 |
| `resourceCount` | 去重后的直接资源数量。 |
| `reports[].knownBytes`、`metadataComplete` | 已取得大小的合计；后者为 false 时，总量只是已知部分。 |
| `readBudgetUsedBytes`、`skippedFiles` | 预留的最大读取量、未完成文件检查数；读取失败时实际读取可更少。 |
| `files` | 大小、类型、`duplicateCheck`，及适用时的 `compressibility`：算法、全文／采样 method、输入与压缩字节、比例、阈值。 |
| `duplicateGroups` | 本次已逐字节确认的副本组；是否合并仍需按来源与用途判断。 |
| `summary` | 本次全部 finding 的 `warnings`、`info` 及 `byCode` 分类计数；关闭的规则不计入，派生的覆盖提示单独表达。 |
| `findings`、`omittedFindings` | 完整返回本次实际产生的全部明细，不设输出条数上限，`omittedFindings` 为 0；覆盖不足优先，其余 warn 先于 info，同级按确定副本、体积／数量、类型、可压缩性排序，再按 code、路径和消息稳定排序。 |

stderr 先给检查状态、分类汇总和预算用量，再给覆盖提示及优先级最高的至多 12 条明细；其余明细引导至 JSON 的 `resourceReview.findings`，不重复输出。普通格式化 JSON 与 `--json` 的 findings 均完整；读取预算和文件数上限仍限制扫描工作量，未检查范围由 `complete`、`skippedFiles` 等字段表达，不等同于输出截断。

发布预检表达预计发布时的观察，正式发布诊断使用本次准备结果；调用结束后文件仍可能变化。没有 finding 仅表示当前策略与覆盖下未触发信号，不能证明材料必要、无语义重复或安全。
