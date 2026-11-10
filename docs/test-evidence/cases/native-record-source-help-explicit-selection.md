### Case NATIVE-RECORD-SOURCE-HELP-EXPLICIT-SELECTION-001: 帮助尊重显式定位和配置替代

Tests:
- `test:c4b11c859587880d851c546b15d9d9cb97d1b6161daa5bf4c8c85e90ea21afd9`

Tags:
- `cli-help`
- `investigation-report`
- `record-rust`

Contract:
- help 的来源上下文尊重显式 root 与显式配置，显式配置替代自动项目／本地层。

Proves:
- 显式 root 的帮助显示 explicit location 而不是默认 related；--config alternate.json 的命令前选项生效，帮助显示 other 与配置路径且不列出被替代的 related key。
