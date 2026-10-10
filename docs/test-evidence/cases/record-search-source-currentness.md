### Case RECORD-SEARCH-SOURCE-001: 各领域按自身职责表达发布快照来源

Tests:
- `test:11e02aea8eb025b8d8c61dcb3b5a179aa7e6dedeee52bc33c92e075f50e42097`
- `test:6547fc8be0f76d6da95f4040d1f157a7f9a2511731407707618244bb4c9406b9`

Tags:
- `record-search`

Contract:
- metadata 可以返回结构有效的发布快照，计数仅覆盖快照；Decision 保留来源核对，Investigation 不读取来源、固定 published-index / unchecked / fallback=false。

Proves:
- Decision 来源漂移与不可核对状态保留不同 currentness 和 warning；Investigation 两种状态均不读来源、不发来源 warning，并保留快照计数。
- Investigation content 面对不安全必需来源保持 error、searchInfo=null。
