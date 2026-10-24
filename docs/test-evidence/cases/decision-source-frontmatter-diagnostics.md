### Case DECISION-SOURCE-DIAGNOSTICS-001: 解析交接保留错误类型与顺序

Tests:
- `test:b7ef685ea6fb8a89b7162cb7e2579278047311173fb47df48e18fb8eec0a7233`

Tags:
- `decision-records`

Contract:
- 同阶段解析复用不省略失败输入，非法 frontmatter 仍先于正文及物理位置错误报告。

Proves:
- 缺失 frontmatter、非 mapping、坏 YAML 与重复 key 都不成为可用身份；正式扫描先保留对应解析诊断，再报告正文结构与位置诊断，并保留原始文本。
