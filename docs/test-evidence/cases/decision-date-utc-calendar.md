### Case DECISION-DATE-UTC-CALENDAR-001: 日期身份采用 UTC 日历日

Tests:
- `test:20eff48132713cfa9adce62e3c0a7f0e5bf0396580fb555c4e17c6c777b9399c`
- `test:299fb5d64944f4d8579b901d321e2cc39110be2eee6edd096066971139f97e58`
- `test:b02d5ea0943b15e55bf75f4e2ec4a018c2b02ee6bd864b3ce48846d7e4e135d7`
- `test:c7b91b476bca4b8ae75a0dc36529321911b60689b75a9f09bce1345555497e38`
- `test:f54fbd119a4cc12e97f4b7ac40b4d90c8d841a6f8f8cbbda6d9d3bc0f690d9e6`

Tags:
- `decision-records`

Contract:
- 日期身份按输入时刻的 UTC 年月日生成六位日期前缀，不按本地或输入 offset 日历日取值。

Proves:
- 五个固定时刻分别对照独立字面日期，覆盖跨年、平年/闰年二月边界、世纪格式与正负时区偏移。
