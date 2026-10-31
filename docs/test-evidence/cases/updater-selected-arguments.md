### Case UPDATER-SELECTED-ARGUMENTS-001: updater 选组仅支持只读检查

Tests:
- `test:3965b15d18e0084362ddc8711a071c06ae785690bde733b0d3f6e3d897d39321`

Tags:
- `repository-tooling`

Contract:
- updater 无选组保留全量默认 check 与显式 write；重复 --skill 仅能在 check 中追加去重合法名称。

Proves:
- 默认与 write 解析形态不变，两域加重复形成首次顺序集合；缺值、空名、路径、大小写非法名、write+skill、check+write 与未知参数被拒绝。
