### Case INVESTIGATION-RESOURCE-NAME-001: 白名单接受常用可读名称并拒绝结构隐患

Entry:
- `tools/investigation-report/tests/resources.test.ts > resource ID whitelist accepts common names and rejects structural hazards`
- `bun test --test-name-pattern="^resource ID whitelist accepts common names and rejects structural hazards$" ./tools/investigation-report/tests/run.ts`

Contract:
- 资源 ID 只接受固定契约列出的汉字、ASCII 英文、数字与常用符号；路径段不得使用首尾点、纯符号名称或 Windows 保留设备名，ASCII 括号允许空内容和最多 32 层的成对嵌套。

Proves:
- 包含中文目录、大小写英文、数字和契约列出的每一种符号的四条资源 ID 均通过完整校验并原样进入索引。
- `响应().json` 与 32 层嵌套括号合法；隐藏名、尾点、Windows 保留设备名、纯符号段、不成对或 33 层括号、空白、URL/路径控制符、`&`、反引号和 emoji 均被拒绝。
