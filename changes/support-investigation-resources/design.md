# Design

允许报告按需用本地链接引用资源，并用统一资源池、主题 state 和集合级哈希管理已声明的引用及其文件。

## Context

已确认事实：

- [调查报告固定契约](../../skills/investigation-report/references/investigation-report-contract.md)让每个主题 Markdown 保存一组按形成时间追加的 H3 报告，每份报告以 `形成时间` 开始并包含四项固定核心。
- [主题级索引决策](../../docs/decisions/investigation-report/maintain-topic-level-investigation-index.md)规定相对主题路径是稳定 ID，每个主题只产生一个索引 entry，Markdown 与领域文件是事实源，`investigation-index.json` 是可删除重建的查询投影。
- 本 change 开始前的通用索引使用 schema v3：`entries` 与 `sourceRevision.entries` 以主题 ID 键控，`sourceRevision.metadata` 独立指纹化集合级来源；调查领域 definition version 为 `2`，metadata 为空。
- 一项原始材料可能只支持一份报告，也可能被多份报告或主题共享，因此引用关系必须在报告处声明，不能从资源目录位置猜测。
- 原始参数、响应、日志、规范摘录和图片需要保留原始字节，但报告正文仍需解释影响结论的关键事实。

约束：

- 资源引用是报告的可选能力；没有 `随附资源` 字段的报告继续合法，管理责任只覆盖报告已经声明的引用及资源池中的文件。
- 资源能力必须同时支持文本和二进制普通文件，并让资源集合或内容变化参与索引新鲜度判断。
- 主题路径、四项固定核心、追加演进模型和无资源报告格式保持不变。
- 关系与哈希可以进入派生索引，但索引不能成为手写事实源。
- 完整 `check` 和 `list` 可以读取并哈希全部资源；大文件存储和增量性能优化不属于本 change。

## Goals / Non-Goals

目标：

- 允许报告在需要时直接链接支撑该报告的形成时材料，不要求每份报告都拥有资源。
- 管理已经声明的资源引用，使报告 Markdown、资源文件和派生索引分别承接引用关系、材料内容以及查询与完整性投影。
- 让缺失、替换、重命名、越界和未引用资源能够被确定性发现。
- 保持正文独立可读，并保留历史报告形成时资源的证据语义。

非目标：

- 不让资源取代报告正文、四项固定核心或调查主题身份。
- 不把资源正文加入主题文本查询，也不增加资源查询 key 或独立资源 entry。
- 不建立通用制品仓库、远程缓存、大文件传输、版权或秘密管理能力。
- 不为资源定义报告之外的归属声明、独立状态或第二份人工清单。
- 不承诺资源变化可以按单个主题 ID 独立暂存调查索引。

## Decisions

长期边界由[主题级索引基线](../../docs/decisions/investigation-report/maintain-topic-level-investigation-index.md)和[随附资源方向](../../docs/decisions/investigation-report/attach-verifiable-resources-to-investigation-reports.md)承接；本节只固定当前 change 的引用语法、落盘形状和实现边界。

### 1. 报告直接声明资源引用

`随附资源` 不是每份 H3 报告的必需字段。报告不需要资源时，在 `形成时间` 后直接进入四项固定核心；需要引用资源时，紧接着出现一次 `随附资源`，且其嵌套列表至少包含一个本地 Markdown 链接：

```markdown
### 核对用户接口参数
- 形成时间: 2026-08-06T16:00:00+08:00
- 随附资源:
  - [接口参数原文](../_resources/api/get-user-parameters.md)
  - [原始响应样本](../_resources/api/get-user-response.json)

#### 形成时背景
...
```

只有报告声明了 `随附资源` 时才应用以下字段约束：每个子项只包含一个展示文字非空的本地链接，目标固定为 `../_resources/<resource-id>`，不能携带查询、片段、链接外文字或其他节点。同一报告不能重复引用同一资源；同一资源可以被不同报告或主题引用。报告不引用资源时省略整个字段。

报告 Markdown 是已声明报告到资源关系及展示文字的唯一事实源。索引只保存规范化资源 ID，不复制展示文字或 Markdown 语法，也不为未声明资源的报告补造关系。

### 2. 统一资源池与资源 ID

调查根目录新增可选保留目录 `_resources/`。资源可以平级或嵌套；相对 `_resources/` 的规范化 POSIX 路径是资源 ID，目录结构只用于组织和身份，不表达主题归属。

资源 ID 不能是绝对路径，不能包含空段、`.`、`..`、反斜杠、查询、片段或百分号编码。每个路径段只使用小写 ASCII 字母、数字、连字符、下划线和点，并以字母或数字开头和结尾。报告文件固定位于一层 category 目录，因此链接目标可以确定性地由 `../_resources/<resource-id>` 还原资源 ID。

`_resources/` 中的每个普通文件必须至少被一份报告引用。完整发现拒绝资源根、任一路径分量或文件本身为符号链接，拒绝非普通文件、缺失目标、实际大小写不一致和孤儿文件。资源目录中的 Markdown 只作为资源，不参与主题发现。

### 3. 在当前 schema v3 索引中投影引用

调查领域 definition version 从 `2` 提升到 `3`，通用 `schemaVersion` 保持 `3`。每个主题的 `entries[id].state` 新增必需的 `resourceReferences`：

```json
[
  {
    "reportIndex": 0,
    "resourceIds": [
      "api/get-user-parameters.md",
      "api/get-user-response.json"
    ]
  }
]
```

`reportIndex` 是主题内 H3 报告的零基序号，与 `reportTitles` 同位置；只投影拥有资源的报告。对象按 `reportIndex` 排序，每个 `resourceIds` 彼此唯一并按 ID 排序；同一报告出现重复资源引用时解析失败，不能通过投影时去重接受。序号是可重建的主题内投影，不是跨版本持久身份；主题没有资源时保存空数组。

索引 metadata 新增按 ID 排序的资源摘要表：

```json
{
  "resources": [
    {
      "id": "api/get-user-parameters.md",
      "sha256": "<64 lowercase hexadecimal characters>"
    }
  ]
}
```

每个被引用资源只出现一次。metadata 不保存资源正文、展示文字、反向主题列表或独立资源 entry。领域 parser 和 `validateIndex` 交叉校验 state 引用的每个 ID 都恰好存在于 metadata 资源表；没有资源的集合显式保存 `"resources": []`。

### 4. 资源参与集合级 source revision

`sourceRevision.entries[id]` 继续只指纹化对应主题的 POSIX 路径和规范化 Markdown 文本。`sourceRevision.metadata` 改为稳定指纹化按 ID 排序的资源 ID 与原始字节 SHA-256；资源 metadata 与 metadata revision 来自同一次资源读取。资源新增、删除、重命名或内容变化都会改变集合级 revision，而单个主题 Markdown 变化仍只改变对应 entry revision。

`sync-index` 在同一次完整读取中解析报告引用、发现资源、校验完整集合并构建 state、metadata 和 revision；写入前重新读取完整 revision，主题或资源在构建期间变化时拒绝替换索引。

默认全量 `check` 重建完整投影并检查索引。`list` 不重新解析报告正文，但会发现主题与资源、读取当前字节并核对结构化 source revision。资源集合或内容导致陈旧时，调查领域比较索引 metadata 与当前资源摘要并报告新增、删除或内容变化的资源 ID；该诊断留在 `investigation-report` 内，不扩展通用 `index-runtime` 契约。

带 `--category` 或 `--path` 的局部 `check` 只解析命中主题，校验其资源 ID 和被引用文件；它不证明全局孤儿状态、metadata、source revision 或索引可查询。

### 5. 正文与历史资源责任

正文在 `调查范围与依据` 或相应支撑章节中说明资源的来源、观测条件、是否经过摘录或转换，以及它如何支持调查结果，并概括影响结论的关键事实。已有稳定事实 owner 足以复核时直接引用该 owner；只有需要形成时快照时才保存资源，并只保留复核所需的最小非敏感内容。

历史报告引用的资源属于其形成时证据。新的实质材料使用新资源 ID 并追加报告；只有修正未准确保存的当时材料、无语义格式问题或移除不必要敏感信息时才原地修改。SHA-256 和 source revision 只暴露变化，不判断来源可信、内容安全或修改是否合法。

## Risks / Trade-offs

- 完整 `check` 与 `list` 需要读取并哈希全部资源；这适合仓库规模的随附材料，不替代大文件后端。
- 资源 ID 使用路径，移动文件会成为显式删除与新增，并要求同步修改所有报告引用。
- `reportIndex` 依赖报告顺序；追加报告不会改变旧序号，原地重排或删除历史报告会改变投影并由索引差异暴露。
- SHA-256 能发现当前内容与索引不一致，不能证明内容来源可信、没有敏感信息或一次修改符合历史语义。
- 路径校验通过规范路径 containment、文件身份绑定和写前完整 revision 复核覆盖静态状态与普通并发变化；跨平台 Node 不提供目录描述符相对打开，因此该工具不承诺隔离能够精确竞态系统调用的恶意主机进程。
- 资源摘要位于集合级 metadata；新增、删除、重命名或修改资源时，按 ID 暂存索引的公共能力会拒绝集合级变化，调用方需要暂存完整调查索引。本 change 不改变这一边界。
- 单一资源池可能积累杂物；孤儿拒绝和报告正文的用途说明共同约束其范围。

## Open Questions

无。
