### Case CHANGE-PLAN-CHECK-PATH-001: 检查报告 change 目录路径问题

Tests:
- `test:a501c61b3f54eb0cdbf888f73fcd0cc25054bdda55f2cdeb7860fc23e75b5bab`

Tags:
- `change-plan`

Contract:
- Change 检查把名称、目录身份和必需文件位置问题映射为各自稳定诊断。

Proves:
- 非 kebab-case 名称、缺失目录、不可读取路径、普通文件路径和缺失 `design.md` 分别产生对应的名称、目录或文件诊断。
