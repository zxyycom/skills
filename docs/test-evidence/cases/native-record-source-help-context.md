### Case NATIVE-RECORD-SOURCE-HELP-CONTEXT-001: 帮助展示来源上下文而不读取索引

Tests:
- `test:9235e87b32b0b8f853ac35e6aa8085560d29edff2fe524d273c4e70cd598a975`

Tags:
- `cli-help`
- `investigation-report`
- `record-rust`

Contract:
- 调查顶层与命令级帮助附带来源 key 和展开目录，选项在命令前后均被识别；不以报告或索引可读作为帮助前提。

Proves:
- 第一源索引损坏时，--help、help 及 show 的两种帮助形式均退出 0，保留 Usage、related key、实际选择和两源目录。
- 显式 key 分别置于 help 前后，均显示相同选源上下文。
