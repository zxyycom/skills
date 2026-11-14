# 资源记录模型

记录放在工作区 `resources/records/` 的直接普通 Markdown 文件中，YAML frontmatter 保存结构，正文解释用途、判断和限制；文件名不是身份。`schemaVersion: 1`；集合和资源 ID 全局唯一，ID、版本和成员键区分大小写，只允许字母、数字、`-_.`。中文可用于标题和标签。

集合可有一个 `parent`、标签和 `selections`；资源恰归属一个集合并有至少一个版本。版本的 `files` 和 `members` 分别可为空，但不能同时为空；二者共享成员 ID 命名空间。版本 `parents` 表示制作沿革，不代表现行用途。用途选择属于声明它的集合、不继承，目标必须属于该集合或其后代；slot 在集合内唯一，basis 明确是 `agent-provisional`、`user-preference` 或 `user-confirmed`。

精确引用为 `{resource, version, member?}`。文件和图包成员引用必须指定 member；图包成员须指向目标资源版本的 `files` 中的文件；目标可以属于其他资源，但不得指向图包成员或嵌套图包。图包顺序以声明顺序为准。文件 role 为 `primary` 或 `derivative`；`sha256` 未知时为 null，缺少哈希或稳定位置时 `gap` 必填。位置为 `{kind: workspace, path}` 或 `{kind: external, storage, path, custody}`，均使用对应根下相对路径，路径不允许 NUL、反斜杠、冒号、空组件或 `.`、`..` 组件；custody 指向工作区内保管说明。证据为 `{path, locator?}`，路径相对工作区，locator 标识文档条目。

文件 relations 的 type 为 `input`、`preview-of` 或 `reference`，含 target、evidence 和 scope；target 必须恰为 `{record: 精确文件引用}`、`{evidence: 证据}`、`{unknown: 原因}` 之一。input 的 evidence 必须定位调用条目，order 为同一输出文件同一调用内唯一正整数。未登记和未知目标是追溯终点，不是已登记的依赖边。反向关系派生；完全重复关系错误，不同作用的同目标关系允许。

集合父子、版本 parents 和文件依赖分别校验循环；文件依赖只包含 input 与 preview-of，并解析图包别名。reference、集合归属、用途选择不参与文件依赖环判断。预览引用本版本主文件合法。标签只用于精确筛选，不代替层级或选择。
