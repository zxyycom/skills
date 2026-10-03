### Case RECORD-SEARCH-SOURCE-001: 发布快照区分陈旧与未核实来源

Tests:
- `test:11e02aea8eb025b8d8c61dcb3b5a179aa7e6dedeee52bc33c92e075f50e42097`
- `test:c57efe5c5b464152e632488bca1d7f44ce092d7736209a81ab9edd97a44b9fa7`

Tags:
- `record-search`

Contract:
- metadata 可以返回结构有效的发布快照；revision 不同为 stale，核对失败为 unchecked，计数覆盖仅对应快照。

Proves:
- 来源正文漂移与符号链接导致的核对失败各有独立 currentness 与来源 warning，并保留相同快照计数。
- Investigation content 面对不安全必需来源保持 error、searchInfo=null。
