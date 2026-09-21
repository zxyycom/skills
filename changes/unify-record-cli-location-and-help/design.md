# Design

本 design 先固定路径角色，再让两个 CLI 共享同一公开语法、解析顺序和错误恢复。

## Context

| 路径角色 | 定义 |
| --- | --- |
| 脚本安装位置 | 只定位可执行脚本，不决定目标数据。 |
| 进程当前目录 | 省略 `--root` 时的默认工作区根。 |
| 工作区根 | 解析领域目录，并提供项目与版本控制边界。 |
| 领域集合目录 | 工作区内保存 Decision 或 Investigation 数据的相对位置。 |

两个领域都需要同时支持“在目标工作区中执行”和“从其他目录操作显式工作区”，因此 `--root` 是可选定位参数，而不是规范调用的必填模板。

## Goals / Non-Goals

目标：

- 相同 argv 在两个 CLI 中得到相同的命令选择、help 和定位结果。
- 默认调用以当前目录为工作区根，跨工作区调用才显式提供 `--root`。
- 路径错误直接给出工作区根与领域目录的正确组合。

范围边界：

- 工作区发现保持显式，不向上搜索 Git root 或领域索引。
- `--root` 始终表示工作区根；领域目录由 `--decisions-dir` 或 `--investigations-dir` 表示。
- 生命周期、关系、索引维护和 staging 行为由各自 Change 承接。
- 旧命令、旧参数和旧调用形态不属于兼容表面；parser 不识别其历史身份，也不输出迁移专用提示。

## Decisions

### Intended Change

两个 CLI 公开以下语法：

```text
<cli> [global-options] <command> [command-options]
<cli> help [command]
<cli> <command> --help
```

- `--root` 的默认值是 `process.cwd()`。
- `--decisions-dir` 与 `--investigations-dir` 只接受相对于工作区根且规范化后仍在工作区内的路径。
- 全局选项可以位于 command 之前或 command options 之后；重复参数、`--` 终止符和多余位置参数使用共同规则。规范 help 与示例把全局选项放在 command 之前。
- Help 只解析请求并渲染静态命令信息，不读取集合状态。
- 缺少 command 时渲染顶层 help，并以参数错误退出。
- 当 `--root` 指向领域集合目录时，诊断给出 `--root <workspace> --*-dir <relative-collection>` 的恢复形态。
- 被目标语法移除的旧命令与旧参数进入普通未知命令或无效参数路径；不保留别名、弃用期、legacy detector 或迁移文案。

### Resulting Impacts

- Investigation Report parser 改用仓库现有的 Commander 依赖，并保留领域 command handler；不新增共享 parser 包。
- Decision Records location API 与 CLI 采用相同的相对领域目录类型和 containment 校验。
- 绝对领域目录与工作区外路径统一返回普通参数错误；旧解析分支、help 条目和相关测试由目标契约取代，不增加历史输入特判。
- 两个 skill 与人类入口采用“当前目录优先”的示例，并只在跨工作区示例中展示 `--root`。
- 受影响的仓库短命令、生成制品、skill 版本、argv 测试和 Test Evidence 同步更新。
- 公共定位和 help 契约形成或演进一份长期 Decision Record。

## Risks / Trade-offs

| 风险 | 控制 |
| --- | --- |
| 既有绝对领域目录调用失效 | 按当前参数约束返回普通错误并展示当前 help；不识别或转换旧调用。 |
| 全局选项的两个合法位置产生歧义 | 重复参数、终止符和位置参数由共同 argv 测试固定。 |
| 当前目录默认值被理解为自动发现 | Skill 明确要求进程位于目标工作区；工具不执行向上搜索。 |
| Help 意外依赖无效集合 | Help 路径在集合解析前完成，并由无集合 fixture 验证。 |

## Open Questions

无。

## Implementation Dependencies

这是记录维护系列的首个实施 Change，不依赖其他记录 Change。它只建立 argv、location、help renderer
和普通参数错误基础；后续 Change 拥有各自命令的领域语义与 help 内容。
