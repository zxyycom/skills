### Case LIGHTWEIGHT-JUDGMENT-LOG-JOURNAL-MODE-001: 确认 WAL 返回值

Tests:
- `test:9c20adb58f13b725af415c3f24a20e9ebdd993f3b9762c13531d499cc631e031`

Tags:
- `lightweight-judgment`

Contract:
- WAL 切换必须确认返回 wal；无异常但返回其他模式不能当作准备成功。

Proves:
- 独立 Node worker 在生成 CLI 的 WAL statement.get 边界注入 delete 模式，无 BUSY 时不重试；一次尝试后退出4、fetch=0且没有调用记录。
