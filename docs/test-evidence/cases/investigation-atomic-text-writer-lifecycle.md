### Case INVESTIGATION-ATOMIC-TEXT-WRITER-LIFECYCLE-001: 调查原子正文写入保持目标边界并收束临时文件

Tests:
- `test:2b2f8dd3a0b4b440f77457c3a4a0a42c111be637bf71703d63c37288a123c1d1`
- `test:6fe4d01ac41606d8fe7cbe1728e520d743efcda0bc5860bb10d4adc0959a57d4`
- `test:8d72f3bc50918cca2323cb5b2aa88915db96616ca664d6f02d412846a6d02c8c`
- `test:cf020a6437ec174bc50dc62e1b818fb787d9f96f5e193db47cb30025d9724663`
- `test:d7e63e46f49b139b4e5293fc1aeec11c2d73e107dba5deb46e00bc62a1703c35`
- `test:e340539fdad92bab38345d62c5625e4b828750ed9f8cdaa46cc8e4c96c24706b`

Tags:
- `investigation-report`
- `record-operations`

Contract:
- Investigation 原子正文 writer 只更新已存在的普通非符号链接文件并保留其 mode；缺失目标保留 not-found 失败语义，不隐式创建来源。
- 发布前写入失败时收束本次临时文件并保留原目标；临时清理也失败时保留两项失败。默认 discard 按实际写集恢复并独立验收，不能因 writer 遗漏临时清理而留下额外集合成员。
- discard 的公开结果分别保留聚合失败中的操作与清理原因、可靠的系统错误类别及已知定位；集合内系统路径以明确的 collection-relative 锚点给出，未知或根外路径不解除现有净化。

Proves:
- 对真实临时 FileHandle 的 writeFile、chmod 与 close 分别注入失败后，writer 返回原失败，目标 bytes、mode、dev 与 ino 保持不变，目录只剩原文件。
- 临时 chmod 与 unlink 同时失败时，AggregateError 保留两个原始错误，原目标不变，未清理临时文件仍在现场；该观察不证明自动清理失败现场。
- 缺失目标以 ENOENT 拒绝且不创建文件；符号链接目标被拒绝，链接及其指向文件均不被改写。
- 真实默认 discard 的索引临时 chmod 失败后返回原失败及 rolled-back，所选报告、未选报告和索引字节恢复，集合不残留临时文件；该小场景不替代并发 winner 或其他资源恢复测试。
- 真实默认 discard 的索引临时 chmod 与精确临时路径 unlink 同时失败时，errors 和 diagnostics 分别保留两根因；清理诊断给出 access-denied、unlink 及以集合根为锚点的实际临时 basename，结果保持 partial-or-unknown，旧集合字节和临时现场均保留。
- 空 AggregateError、循环引用的 AggregateError 与非 Error writer 失败仍形成保留原原因的公开错误结果，不因展开失败而丢失诊断或无限递归；这些无临时残留的场景继续正确恢复。
