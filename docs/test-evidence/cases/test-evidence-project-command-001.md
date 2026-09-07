### Case TEST-EVIDENCE-PROJECT-COMMAND-001: 项目快照命令解析只接受受限测试形式

Tests:
- `test:36868b7785c201294ecfdd722fadbcc9d2b22eab00e85eb70e857f961d54b7b7`

Tags:
- `repository-tooling`

Contract:
- 项目快照只解析以 && 连接、且显式指向项目内文件的 bun test 或 node --test 命令；其他 shell 形状必须阻断。

Proves:
- 合法 Bun 与 Node 测试命令被识别，展开、重定向和不受支持命令形状被拒绝。
