### Case DECISION-STAGE-CLI-001: CLI 独立公开 Stage 且不扩展生命周期选项

Tests:
- `test:e3b53b3b1d2f02f6d81ebfc70955a6ca774da27659b52917d625951181ce426f`

Tags:
- `decision-records`

Contract:
- stage 是独立命令，生命周期命令不应接受 --stage。

Proves:
- 根帮助包含 stage，生命周期子命令帮助均不含 --stage。
