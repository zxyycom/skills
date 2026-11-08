### Case INVESTIGATION-ACQUISITION-LOCAL-001: 单条读取与局部检查按需取得普通来源

Tests:
- `test:9fce3c04922a6c38202fdeb907eae7cc944be4d67bb9a8f16ef09aea075289c4`

Tags:
- `investigation-report`

Contract:
- 局部检查只承诺所选来源，不将无关坏正文当作所选来源错误。

Proves:
- fixture 中加入无关非法来源后，selected 检查成功而 full 检查失败。
