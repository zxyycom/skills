### Case RESOURCE-CLI-CONTRACT-001: CLI 输出与结构错误

Tests:
- `test:40c5f0c6b8d4cf21d9b6c7de4d4c1c53e2cab3f6a7cc55f8d1e33e031c37dacc`
- `test:4a577f6e01c50cd06a63c798a8270dd198d64b90364047cbbc3aafd548e926a0`
- `test:79ac9d5cbcf4d98bf6e6c03f62f7fbf476d52cdee4027885f87045c7b32b9a23`
- `test:99331eb72a792af6055d334d21dd097186ff64c5b2955d101166ec7a739c407c`
- `test:b8af7d351ea327ff0361f87620175f88cfde67754d012e22e1e000f293690b7d`

Tags:
- `resource-records`

Contract:
- CLI 区分 JSON 与普通输出通道、参数错误与记录错误；解析后的选项和命令决定错误通道与 envelope.command。非 Unicode 实参属于参数错误；非法记录不生成索引。

Proves:
- 真实进程核对帮助、stderr 和退出码、JSON 错误 envelope；列表帮助包含两种视图，非法记录拒绝缺字段、非法角色、重复 YAML 键及多目标。
- list 同时指定两种视图、或 show 指定任一视图时，返回退出码 2 和对应参数错误原因。
- 选项值 `--json` 不触发机器输出。先传未知选项也不妨碍识别后续实际 `--json` 和 `list`，根路径值 `show` 不被识别为命令；两种调用均以退出码 2 和对应通道报告未知选项。
- 非 Unicode 的 `--tag` 值保留后续 `--json` 与已解析命令，非 Unicode 的 `--` 后位置实参以普通 stderr 报错；两者均以退出码 2 退出。
