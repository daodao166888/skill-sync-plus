# X Promotion Drafts

## Main Post

我 fork 了一个开源 Codex Skills 管理工具，做了个增强版：

Skill Sync Plus

它不只同步 `~/.codex/skills`，还新增了 `skill-sync audit`：

- 检查 SKILL.md frontmatter
- 发现太短/太长的描述
- 找出缺失的 scripts/templates/assets 引用
- 给每个 Skill 打分

适合开始认真管理自己 AI Agent 工作流的人。

Repo: https://github.com/daodao166888/skill-sync-plus

## Thread Version

1/ 我最近在整理自己的 AI Agent Skills，发现一个问题：

Skill 越写越多以后，真正麻烦的不是“有没有同步”，而是“哪些 Skill 质量其实不稳定”。

所以我 fork 了 Skill Sync，做了一个增强版：Skill Sync Plus。

2/ 原项目已经能把 Codex/Agent Skills 通过 Git 同步到自己的仓库。

我这次补的功能是：

```bash
skill-sync audit ~/.codex/skills
```

它会扫描每个 `SKILL.md`，输出评分、问题和修复建议。

3/ 目前会检查这些东西：

- `name` / `description` 是否完整
- description 是否太短、太长、不可发现
- 正文有没有清晰标题和 workflow
- 引用的 scripts/templates/assets 是否真实存在
- 是否有 examples/templates/references 等辅助材料

4/ 为什么要做这个？

Agent 选择 Skill，主要靠 description。
Agent 执行 Skill，主要靠 `SKILL.md`。

这两个地方一旦写弱了，后面看起来像“模型不稳定”，其实是工具指令不稳定。

5/ Repo 放这里：

https://github.com/daodao166888/skill-sync-plus

这是一个很小的改进，但我觉得是管理 AI 工具链时很实用的一步：

先把 Skill 从“能用”推进到“可发现、可复用、可维护”。
