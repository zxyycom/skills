### Case TASK-GRAPH-SERIALIZATION-001: 规范文本按键排序，往返解析不丢失事实且 entry 不重复保存 ID

Tests:
- `test:b3a08383fde9a9db239717d88f18b7ac24a33af74f757a76b309f2d43294e2cf`

Tags:
- `task-graph`

Contract:
- task index 以根级 task 字典键承接身份，并使用确定性排序、LF 与尾换行规范序列化。

Proves:
- 规范文本按键排序，往返解析不丢失事实且 entry 不重复保存 ID。
