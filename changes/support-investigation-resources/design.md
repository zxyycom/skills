# Design

沿用主题级调查索引，以统一资源池、报告级 Markdown 引用和索引内关系与哈希投影实现随附资源。

## Context

已确认事实：

- [调查报告固定契约](../../skills/investigation-report/references/investigation-report-contract.md) 让一个主题 Markdown 按形成时间保存多份 H3 报告，并让每个主题只产生一个索引 entry。
- [主题级索引决策](../../docs/decisions/investigation-report/maintain-topic-level-investigation-index.md) 规定 Markdown 与领域源是事实来源，`investigation-index.json` 是可以删除重建的查询投影。
- 一份资源可能只支持某一轮报告，也可能被多个报告或主题共享，因此关系需要在报告处声明，不能从目录位置猜测。
- 原始参数、响应、日志、规范原文和图片需要保留原始字节，但正文仍需解释影响结论的关键事实。

约束：

- 资源能力必须兼容文本和二进制文件，并让内容变化参与索引新鲜度判断。
- 主题路径、报告四项固定核心、追加演进模型和无资源报告格式保持不变。
- 关系与哈希可以进入派生索引，但索引不能成为手写事实源。
- 完整检查和 `list` 可以为资源完整性重新计算哈希；大文件优化不属于本 change。

## Goals / Non-Goals

目标：

- 让读者从报告直接打开形成时随附材料，并能判断材料支持哪一份报告。
- 让 Markdown、资源文件和派生索引分别承接关系、内容以及查询与完整性投影。
- 让缺失、替换、重命名、越界和未引用资源能够被确定性发现。
- 保持正文独立可读，并保留调查形成时证据的历史语义。

非目标：

- 不把资源正文加入主题文本查询，也不增加资源查询 key 或独立资源 entry。
- 不建立通用制品仓库、远程缓存、大文件传输、版权或秘密管理能力。
- 不为资源定义独立状态、报告之外的归属声明或第二份人工清单。

## Decisions

长期边界由[主题级索引基线](../../docs/decisions/investigation-report/maintain-topic-level-investigation-index.md)和[随附资源方向](../../docs/decisions/investigation-report/attach-verifiable-resources-to-investigation-reports.md)承接；本节固定当前 change 的落盘与实现选择。

### 1. 资源池与报告引用

调查根目录新增可选保留目录 `_resources/`。资源可以平级或嵌套；相对 `_resources/` 的规范化 POSIX 路径是资源 ID，目录结构只用于组织和身份，不表达主题归属。

资源 ID 使用正斜杠分隔且不能是绝对路径。每个路径段只使用小写 ASCII 字母、数字、连字符、下划线和点，并以字母或数字开头和结尾；ID 不包含空段、`.`、`..`、反斜杠、查询或片段。

每份 H3 报告继续以 `形成时间` 作为首个元数据项；需要资源时，紧接着增加一次嵌套链接列表：

```markdown
### 核对用户接口参数
- 形成时间: 2026-08-06T16:00:00+08:00
- 随附资源:
  - [接口参数原文](../_resources/api/get-user-parameters.md)
  - [原始响应样本](../_resources/api/get-user-response.json)
```

每个子项只包含一个本地 Markdown 链接，目标固定为 `../_resources/<resource-id>`；链接文字用于阅读，目标路径派生资源 ID。没有资源时省略整个字段。报告 Markdown 是精确报告到资源关系及展示文字的唯一事实源。

### 2. 主题索引中的关系与哈希

调查索引的 definition version 从 `2` 提升到 `3`。每个主题 entry 保持现有身份、state 和 keys，并新增必需的 `resourceReferences`：

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

`reportIndex` 是主题内 H3 报告的零基序号，并指向现有 `reportTitles` 的同一位置；只投影拥有资源的报告。对象按 `reportIndex` 排序，每个 `resourceIds` 去重后按 ID 排序。该序号是可重建的局部投影，不是跨版本持久身份；主题没有资源时保存空数组。

索引 metadata 新增按 ID 排序的资源摘要表，每个被引用资源只出现一次：

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

entry 负责投影报告关系，metadata 负责共享资源的集合级内容摘要。二者都从 Markdown 与资源文件生成；没有资源的集合仍显式保存 `"resources": []`，不保存资源正文、展示文字、反向所属主题或独立资源 entry。JSON Schema 和领域解析器交叉校验引用的每个 ID 都恰好存在于 metadata 资源摘要表中。

### 3. 完整源快照与维护事务

领域源快照由两部分组成：现有的排序主题路径与规范化 Markdown 文本，以及按 ID 排序的资源 ID 与对其原始字节计算的 SHA-256。`sourceRevision` 对这两部分做稳定 framing；资源 metadata 与 revision 使用同一次读取产生的摘要。任何资源成员或内容变化都会改变 revision，即使 Markdown 和主题 state 的其他字段未变。

`sync-index` 先解析全部报告引用、发现资源并校验完整集合，再构建引用关系、metadata 和 revision；写入前重新取得完整 revision，主题或资源在构建期间变化时拒绝替换索引。

默认全量 `check` 和 `list` 重新取得完整源快照并核对持久索引。资源导致不一致时，工具比较 metadata 与当前摘要，报告具体资源 ID。带 `--category` 或 `--path` 的局部 `check` 只验证命中主题的 Markdown、资源 ID 安全性和所引文件，不证明全局孤儿状态、metadata、revision 或索引可查询。

### 4. 集合与历史约束

`_resources/` 中的每个普通文件必须至少被一份报告引用；同一文件允许被多份报告或主题共享。发现和同步拒绝资源链接逃逸、大小写或路径不一致、任一路径分量为符号链接、目标不是普通文件、引用缺失以及孤儿文件。资源目录中的 Markdown 只作为资源，不参与主题发现。

正文在 `调查范围与依据` 或相应支撑章节中说明资源的来源、观测条件、是否经过摘录或转换以及它如何支持结果，并概括影响结论的关键事实。已有稳定事实 owner 足以复核时直接引用该 owner；只有需要保存形成时快照时才复制资源，并只保留复核所需的最小非敏感内容。

历史报告引用的资源属于其形成时证据。新的实质材料使用新资源 ID 并追加报告；只有修正未准确保存的当时材料、无语义格式问题或移除不必要敏感信息时才原地修改。哈希只暴露变化，不判断修改是否合法。

## Risks / Trade-offs

- 完整 `check` 与 `list` 需要读取并哈希全部资源；这为仓库规模的随附资料提供直接新鲜度证明，但不适合代替大文件后端。
- 资源 ID 使用路径，移动文件会成为显式删除与新增，并要求同步修改所有报告引用。
- `reportIndex` 依赖报告顺序；追加报告不会改变旧序号，原地重排或删除历史报告会改变投影并由索引差异暴露。
- SHA-256 能发现当前内容与索引不一致，不能证明内容来源可信、没有敏感信息或一次修改符合历史语义。
- 单一资源池可能积累杂物；孤儿拒绝和报告正文的用途说明共同约束其范围。

## Open Questions

无。
