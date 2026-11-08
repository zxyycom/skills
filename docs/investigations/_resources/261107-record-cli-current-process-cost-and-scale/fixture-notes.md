# fixture 与失败尝试

私有生成器从当时仓库 `tools/record-cli/benchmarks/fixtures.ts` 复制并仅改变输出根；`fixtures-small.ts` 再放宽数量门槛，用于一条记录。其余来源、关系和正文按脚本确定。每套两域索引由生产 TS `sync-index` 生成，再由生产 `check` 检查；这不是把 TS 的正确性当成唯一 oracle，计量前另做 ID、数量、覆盖和 trace 预期检查。

尝试零条时，DR `sync-index` 返回 `Cannot generate an empty decision index`；随后单独尝试 IR 的空集合 `sync-index`/`check` 也因集合须至少一条而失败。空索引没有因此被证明非法；这次没有测量合法空索引，只测单条记录。

`width2000` 的 fixture 生成器在 IR `check` 时遇到 `spawnSync` 默认 stdout/stderr 捕获限制，报 ENOBUFS 并在写 fixture.json 前中断。生成器失败而不是 check 非零结果。之后将同一个 check 的 stdout/stderr 重定向文件重新执行：退出 0、stdout 为 5000 条全量索引 current，stderr 1,184,161 字节，SHA-256 `75bccb7393c57ec5c3ea5063f004bd465eb8fef9d8f44bf05f6a5d62dbefde9d`；警告是大量“前序报告尚未进入 Git HEAD，请确认关系是否应保留为独立调查演进”。私有 fixture 在主仓库 dist 下，前序均为私有未记录文件，并非主仓库 HEAD 中的正式报告；这只是准备阶段 check 的 warning，计时命令不含该 check。复核通过后写入当次 count=5000、width=2000、depth=8 元数据；未忽略错误或把其计作成功样本。

预采样最初原生 `help --root ...` 退出 2；帮助入口不接受这样的组合，是测量脚本参数错误，相关失败行保存在 `pre-failed-help.jsonl`，不计入正式结果。更正后两端直接 `--help`，重跑完成。所有成功样本均保留，未按耗时删除异常。

`expected-candidate.txt` 展示本轮创建命令对应的完整候选脚手架；其字节 SHA-256 为 `8e36896cb1c7b24e1de46f71ddbe95bc2d57f2ae466e6288e4916b5031042b03`。每次写操作在计时外检查完整内容字节、身份、已知写路径和排除新候选后的其余输入树 hash，然后只删除本轮精确创建的候选文件，恢复下一样本状态。无需 Git pending，也未测试 stage。

资源 collector 额外防污染校准：Python 触碰 128 MiB 后通过 `subprocess.run([collector, '/bin/true'], capture_output=True, text=True)` 调用独立 collector；结果见 `collector-high-parent-calibration.json`。collector 另对 `/bin/true` 与独立触页 64 MiB 程序轮流测量，结果见 `resource-calibration.jsonl`。
