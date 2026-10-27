### Case UPDATER-SELECTED-ARGUMENTS-001: updater 选组仅支持只读检查

Tests:
- `test:28aba50bdb5ccc5bba0188651e3aa105f4d4baede89735e69f5dd52e1b776e83`

Tags:
- `repository-tooling`

Contract:
- updater 无选组保留全量默认 check 与显式 write；重复 --skill 仅能在 check 中追加去重合法名称。

Proves:
- 默认与 write 解析形态不变，两域加重复形成首次顺序集合；缺值、空名、路径、大小写非法名、write+skill、check+write 与未知参数被拒绝。
