### Case VERSION-CONTROL-FINGERPRINT-MODE-FRAMING-001: 指纹模式不改变完整读取失败边界

Tests:
- `test:0d956e7863cdea8757b542a42f439941c3a62b6920973610880a87ae6aa69dec`
- `test:30034bc2f244ba01b313d375b721278c5bd53ea9cf03774024cd253703a648ea`
- `test:66bed47f83615e96d6898b66b8acd57f6c0e4f2045d9a7808d685c6e2ebd0b6f`
- `test:b19d94f9d05c6c4e3db8d4cb8113babfa69249603bf71d13b2355027320acd65`

Tags:
- `version-control`

Contract:
- 是否计算SHA256不改变完整二进制frame、payload、stdout预算与transport失败边界；无指纹结果不得作为指纹结果完成。

Proves:
- 两模式跨逐字节chunk得相同prefix和size，none模式要求指纹完成被拒绝。
- 两模式拒绝missing/type/identity/size错误、截断、separator和多余frame；丢弃全部内容时仍累计完整256MiB stdout预算。
- 真实子进程即使已输出合法frame仍保留非零退出失败，保留prefix之后的payload截断仍失败。
