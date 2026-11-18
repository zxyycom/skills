### Case RESOURCE-LOGICAL-ENTRY-VALIDATION-001: 逻辑入口结构和路径约束

Tests:
- `test:e55ab075125be861a3a0f77ac692e461d00227f252634ce51f8ef91cdaf62ea1`

Tags:
- `resource-records`

Contract:
- 逻辑入口必须是非空的目录或文档入口数组，不与文件或图包成员混用，路径为合法工作区相对路径。

Proves:
- 同步时，空或 null 数组、非法 kind、未知字段、父级跳转、绝对或 Windows 驱动器路径、反斜杠及空路径组件均按对应原因被拒绝。
- 合法入口与文件或成员同装时，分别返回来源文件和版本互斥诊断，而非只检查通用失败状态。
