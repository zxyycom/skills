# MCPShell Workspace Tools

`mcpshell-workspace-tools` 为需要跨执行边界操作项目的 AI 准备四项便捷 tools：`workspace_shell`、`workspace_apply_patch`、`workspace_put_file` 和 `workspace_get_file`。backend 封装工作区位于同机、容器还是真正远端的差异，tools 始终指向一个固定 project root。

AI 查看文件、执行命令、构建、测试和审查 Git 变化时优先使用 shell；修改文档和其他文本时优先使用 patch；只有文件实体需要跨边界移动时才按方向使用 put 或 get。其他 workspace-aware tools 已经验证指向同一项目根时也可以使用。

个人 skill、规则、bridge 配置和 MCP 注册保留在 agent config root。put/get 通过独立 agent staging root 交换单个文件，并用相对路径、byte count、SHA-256、默认不覆盖和原子落盘约束传输结果。

当前 skill 已固定 AI 的工具选择、初始化、恢复和完成契约。确定性的 MCPShell 配置生成、注册以及 command/patch/file transport 仍由后续 bridge provider 交付；provider 尚未进入 skill 包，因此真实 SSH、patch 和双向文件能力尚未可用。

实际行为入口位于 [`skills/mcpshell-workspace-tools/`](../../skills/mcpshell-workspace-tools/)。
