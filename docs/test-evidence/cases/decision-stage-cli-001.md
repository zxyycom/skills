### Case DECISION-STAGE-CLI-001: CLI 独立公开 Stage 且不扩展生命周期选项

Tests:
- `test:da714b2a55d09463b21e9eddabcde8c4942d57443d149186f9cb648969031892`

Tags:
- `decision-records`

Contract:
- stage 是独立命令，生命周期命令不应接受 --stage。

Proves:
- 根帮助包含 stage，生命周期子命令帮助均不含 --stage。
