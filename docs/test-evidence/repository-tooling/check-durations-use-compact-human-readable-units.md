### Case CHECK-DURATION-FORMAT-001: 检查耗时使用紧凑可读单位
Entry:
- `scripts/check.test.ts > check durations use compact human-readable units`
- `bun test --test-name-pattern="^check durations use compact human-readable units$" ./scripts/check.test.ts`
Contract:
- 检查耗时必须按量级使用稳定、紧凑的人类可读格式。
Proves:
- 毫秒、短秒和长秒耗时分别采用整数毫秒、一位小数秒和整数秒。
