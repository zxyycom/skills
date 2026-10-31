### Case LIGHTWEIGHT-JUDGMENT-LOG-JOURNAL-MODE-001: 确认 WAL 返回值

Tests:
- `test:eef960c00d99710bb45268a562207ff214e985bb4feb60efe6d05e8bee1a802a`

Tags:
- `lightweight-judgment`

Contract:
- WAL 切换必须确认返回 wal；无异常但返回其他模式不能当作准备成功。

Proves:
- 独立 Node worker 在生成 CLI 的 WAL statement.get 边界注入 delete 模式，无 BUSY 时不重试；一次尝试后退出4、fetch=0且没有调用记录。
