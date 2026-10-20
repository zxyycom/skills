### Case INVESTIGATION-CANDIDATE-DEFAULT-FORMED-AT-001: candidate API resolves one effective formation timestamp

Tests:
- `test:773d103719b1d409b7d643ebb47eba1b4a13353355ddc8aca01689da8dddd645`

Tags:
- `investigation-report`

Contract:
- `createInvestigationCandidate` 可省略 `formedAt`；准备阶段须读取一次当前时间形成有效值，再以该值规范化 ID。显式时间继续原样校验，不得因非法而回退到默认值。

Proves:
- 纯准备函数在缺省路径只调用一次注入时钟，返回有效候选时间与对应 UTC 日期的标准 ID；不经过文件写入。
- 合法显式时间保持不变且不读取时钟；非法显式时间仍返回选项错误。
