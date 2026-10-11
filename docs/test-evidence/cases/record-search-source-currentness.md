### Case RECORD-SEARCH-SOURCE-001: 各领域按自身职责表达发布快照来源

Tests:
- `test:6547fc8be0f76d6da95f4040d1f157a7f9a2511731407707618244bb4c9406b9`
- `test:e30db019c652c5333afa1f6a0e7b028cfbb995ee74655fa61b02dabb0e043cfa`

Tags:
- `record-search`

Contract:
- metadata 可以返回结构有效的发布快照，计数仅覆盖快照；Decision 与 Investigation 均不读取来源，固定 published-index / unchecked / fallback=false。

Proves:
- Decision 与 Investigation 对来源漂移或不可读均返回 unchecked 发布快照，不发来源 warning，并保留快照计数。
- Investigation content 面对不安全必需来源保持 error、searchInfo=null。
