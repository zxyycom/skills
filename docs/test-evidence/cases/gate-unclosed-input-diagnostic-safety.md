### Case GATE-UNCLOSED-INPUT-DIAGNOSTIC-SAFETY-001: 未闭合路径诊断保持安全有界并如实计数

Tests:
- `test:6ae3e8797b6883d0fe8090bd0c3701af5d30d0311fc5c4b085c9bf16a7754f3a`

Tags:
- `repository-tooling`

Contract:
- 公开输入诊断沿既有脱敏策略，只展示最多五条有界路径；控制字符不能作用于终端，省略数量来自真实路径总数。

Proves:
- 十二个未闭合路径仅展示五条并报告七条省略；命名秘密和 provider token 在紧邻 ESC 时仍脱敏，换行归一化为空格，残留 ESC 与双向控制符转义。
- 普通超长路径及控制符转义后膨胀的路径均截为五百字符，终端摘要小于四千字符；machine 与终端均不泄露 fixture 秘密、provider token、未展示路径或原始 ESC/双向控制字符。
