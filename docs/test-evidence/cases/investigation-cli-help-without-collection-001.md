### Case INVESTIGATION-CLI-HELP-WITHOUT-COLLECTION-001: help 渲染不读取集合状态

Tests:
- `test:d0bf6f8e79a19d027840b0839b4b7ea4a42c42ba35da8522bc44e1b6a9120a1d`

Tags:
- `investigation-report`

Contract:
- `help [command]` 与 `<command> --help` 只解析请求并渲染静态命令信息，不读取集合状态；帮助在集合解析前完成。

Proves:
- 在没有任何调查集合的工作区中，顶层 `--help`、`help`、`help <command>` 与 `<command> --help` 都以退出码 `0` 成功渲染，stderr 为空，且命令帮助只包含该命令的选项而不混入其他命令。
