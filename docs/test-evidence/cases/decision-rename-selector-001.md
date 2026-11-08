### Case DECISION-RENAME-SELECTOR-001: 身份选择精确匹配日期 ID 并拒绝 name 歧义

Tests:
- `test:1f3582ba2a47817bb29d520da0781f7410e5974d644891e49551fee38a400eb3`

Tags:
- `decision-records`

Contract:
- 日期 ID 精确选择，重名 name 不猜测。

Proves:
- 两个不同日期的同名身份中，带 .MD 的完整 ID 精确匹配；name 歧义及不存在的完整 ID 均拒绝。
