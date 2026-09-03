---
name: mcpshell-workspace-tools
description: >-
  当 AI 的现有工具作用于个人 agent 环境、无法直接操作另一个项目工作区时，
  使用 MCPShell 为固定项目根准备 workspace shell、apply-patch 与双向单文件
  tools。工具可用后，文件查看和命令优先用 shell，文档与其他文本修改优先
  用 patch，put/get 仅用于传输文件实体；已有等价 workspace tools 时直接使用。
metadata:
  version: "1"
---

# MCPShell Workspace Tools

## 目标

让 AI 在个人 agent 环境中保留自己的 skill、规则和 MCP 配置，同时获得一组指向固定项目根的便捷 tools，并继续原项目任务。项目在同机、容器或远端由 backend 处理，不改变 AI 的工具选择方式。

```text
agent environment
  -> 建立或恢复固定 workspace bridge
    -> workspace_shell + workspace_apply_patch
       + workspace_put_file + workspace_get_file
      -> 按操作选择工具并继续原任务
```

这些 tools 是默认便捷入口。其他工具已经验证作用于同一项目根且更适合当前操作时，可以直接使用。

## 工具选择

| 当前操作 | 首选 tool | 使用结果 |
| --- | --- | --- |
| 查看项目文件、运行命令、构建、测试、查看 Git status/diff | `workspace_shell` | 命令在固定项目根执行并返回目标状态 |
| 创建、更新或删除文档及其他文本文件 | `workspace_apply_patch` | patch 在固定项目根整体应用 |
| 把 agent staging 中的文件实体传入项目 | `workspace_put_file` | 文件按原始字节写入项目相对路径 |
| 把项目文件实体取到 agent staging | `workspace_get_file` | 文件按原始字节写入 staging 相对路径 |

普通文件查看直接使用 shell。put/get 只在任务需要跨边界移动文件实体时使用。

## Tool 契约

### `workspace_shell`

输入是一段 `command`。backend handle 与 project root 固定在 bridge 中，不作为日常参数。

AI 优先用它查看文件、执行项目命令、构建、测试和运行 Git 审查命令。结果需要让 AI 判断 stdout、stderr、目标退出状态、timeout 和 transport failure；MCP 调用完成本身不代表目标命令成功。

### `workspace_apply_patch`

输入是一份 `patch` payload。第一版接受可由目标侧 `git apply` 检查和应用的 unified diff，用于创建、更新或删除项目中的文本文件。

AI 先用 workspace-aware 工具读取相关上下文，再提交最小 patch；应用结果返回是否成功、受影响的项目相对路径和明确的失败类型。成功后优先用 `workspace_shell` 查看目标内容和 Git diff。二进制文件或 agent 侧已经形成的完整产物优先使用 `workspace_put_file`。

### `workspace_put_file` 与 `workspace_get_file`

两个 tools 使用方向明确的相对路径：

- `workspace_put_file`：`source_path` 位于 agent staging root，`destination_path` 位于 project root。
- `workspace_get_file`：`source_path` 位于 project root，`destination_path` 位于 agent staging root。

`replace` 是默认 `false` 的布尔值。成功结果至少包含 source、destination、byte count 和两端 SHA-256；显式替换也以接收端原子落盘完成。file tools 的当前范围是单个常规文件的原始字节；mode、mtime、owner 和目录级操作由其他能力承接。

agent staging root 是任务交换区。put 适用于二进制、较大文件和 agent 侧生成产物；get 适用于需要交给 agent 侧工具或作为文件实体交付的项目内容。

## 建立或恢复 tools

### 1. 保存任务与定位边界

1. 记录初始化完成后要继续的原任务。
2. 确认当前工具实际作用位置、目标 project root，以及是否已有指向该 root 的 workspace tools。
3. 已有 tools 通过固定 root 和失败语义检查后，直接进入“继续项目任务”。

### 2. 收集初始化输入

优先从当前任务和运行时恢复以下信息，只询问会改变目标且无法可靠推断的字段：

1. **bridge identity**：用于注册、恢复和精确移除该项目 bridge 的稳定标识。
2. **backend handle**：provider 可消费的既有连接标识；第一版可采用 SSH host/alias。
3. **project root**：backend 所见的项目绝对路径。
4. **agent config root**：skill、bridge 实例和 MCP 注册所属的个人配置域。
5. **agent staging root**：内建文件工具与 put/get 交接文件的任务交换区。

project root 与 agent staging root 固定在 bridge 中。切换项目时使用新的 bridge identity。

### 3. 调用 provider

provider 负责确定性地渲染 MCPShell 配置、注册 server、连接 backend，并生成四项 tools。调用前先预览将创建或修改的用户级文件、MCP server identity、固定 roots、验证动作和移除入口。

安装依赖、修改用户配置、注册或替换 MCP server、修改 SSH 配置以及扩大访问范围，需要取得覆盖精确对象的授权。provider 只更新能够证明由同一 bridge identity 拥有的对象。

`scripts/update-skill.mjs` 只执行 skill 更新；bridge 初始化需要独立 provider。当前 skill 包内尚无 provider，因此保留原任务和已恢复输入，并报告缺少的 provider 产物。

### 4. 验证可用性

1. 从运行时取得四项 tools 的实际 callable names。
2. 用 `workspace_shell` 证明当前目录和 `git rev-parse --show-toplevel` 指向 project root，并验证一个只读非零命令的失败状态。
3. 确认 patch 与 file tools 的固定 roots、相对路径和结果字段。真实 patch 或文件传输只随原任务需要发生，不创建专门的项目改动。
4. server 需要会话重载时，交接原任务、bridge identity、project root、agent staging root 和预期 tool names；重载后继续本步骤。

## 继续项目任务

1. 优先用 `workspace_shell` 查看目标项目的指令、导航和任务相关文件。
2. 按“工具选择”处理查看、命令、文本修改和文件传输；采用其他工具时先确认其 project root。
3. 修改后查看实际 Git diff，运行与改动相称的检查，并按目标退出状态判断结果。
4. 完成初始化前保存的原任务；初始化结果本身不替代项目交付。

## 边界与失败

1. 个人 skill、规则、bridge 配置和 MCP 注册属于 agent config root；project root 只保存项目自身内容。
2. agent staging root 与 agent config root 分离，只保存当前任务明确使用的交换文件。
3. patch 和 file paths 保持在配置的 roots 内；绝对路径、`..`、`.git` 内部目标和越界 symlink 属于 path rejection。
4. patch 以全部目标成功为完成状态；失败结果不留下部分修改或项目内临时 patch。
5. file transfer 以 byte count 和两端 SHA-256 一致为完成状态；失败结果不留下部分文件或 helper 临时文件。
6. get 的 source 由原任务决定；凭据、secret 文件和无关项目内容需要单独的明确依据。
7. 修复和移除只作用于 bridge identity 明确拥有的对象；移除由用户明确请求触发。

## 完成标准

1. 四项 tools 的实际名称、project root 和 agent staging root 已恢复并通过相应检查。
2. AI 能按操作选择 shell、patch、put 或 get，并能识别其他已验证 workspace tools 的合法使用场景。
3. 项目指令已从目标工作区读取，后续命令、修改和文件传输落在预期 roots。
4. project root 只包含项目内容，agent staging root 保持为任务交换区。
5. 原任务已经继续执行；未实调的 tool path、provider 缺失或会话重载要求在交付中明确保留。
