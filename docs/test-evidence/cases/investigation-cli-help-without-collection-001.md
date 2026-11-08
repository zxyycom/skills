### Case INVESTIGATION-CLI-HELP-WITHOUT-COLLECTION-001: help 渲染不读取集合状态

Tests:
- `test:2dfd48c79c1d1110d13aa7a23dbfae990286309490720cb51802b13bd7fc659b`

Tags:
- `investigation-report`

Contract:
- help 与版本信息不要求可用工作区或调查集合。

Proves:
- 真实程序对 --help、help stage、--version 及带不存在 root 的顶层和 stage help 均成功输出；缺失命令返回 usage 状态。
