### Case RESOURCE-WINDOWS-CASE-ALIAS-001: Windows 大小写别名目录观察

Tests:
- `test:c55e10913159cf5d56e079933ea83e8ce6df8c9f901c3428f493e45e09be7712`

Tags:
- `record-rust`

Contract:
- Windows 大小写不匹配的资源路径仍须报告真实大小写，多个别名不重复枚举同一目录。

Proves:
- 真实临时目录中的文件及嵌套目录各四种大小写别名均报告大小写不匹配诊断，目录枚举总数保持两次；未断言诊断中的具体实际拼写，此节点仅在 Windows 编译。
