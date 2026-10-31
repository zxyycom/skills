### Case VIDEO-TEXT-OUTPUT-001: 公共文本保留 Unicode 并转义控制字符

Tests:
- `test:8670a4027a90f0fc62efecd60ce33cb49daf34642f2f946ad7475c575514043e`

Tags:
- `video-understanding`

Contract:
- 公共文本读取保留原始 Unicode 内容和可读定位，字幕控制字符不得伪造输出结构。

Proves:
- 换行、制表、引号、反斜杠、NUL 和终端控制符按 JSON 字符串形式输出，不产生伪造 selection 行或 ANSI 控制序列。
