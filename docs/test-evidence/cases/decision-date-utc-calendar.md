### Case DECISION-DATE-UTC-CALENDAR-001: 日期身份采用 UTC 日历日

Tests:
- `test:65e82319e2268592994b6120c8deb2dfef718e83662c0b2893aa93461b38e4b5`
- `test:adf019cc84be5577eb136f5f1a9552337e7effa9e730326f768ecb5b473eda83`
- `test:aee43446598da963bc845e0b3039824296159c5e809663e7baffb3893a8ffa01`
- `test:d3cc44e3da227daf3f657f1daba88079f310ac6add3521f96c889dc0ff5c4bf1`
- `test:fc795e04a40b4121e567654dc6a9cc51f70b7d44cbd72640277bef8b1bf171a8`

Tags:
- `decision-records`

Contract:
- 日期身份按输入时刻的 UTC 年月日生成六位日期前缀，不按本地或输入 offset 日历日取值。

Proves:
- 五个固定时刻分别对照独立字面日期，覆盖跨年、平年/闰年二月边界、世纪格式与正负时区偏移。
