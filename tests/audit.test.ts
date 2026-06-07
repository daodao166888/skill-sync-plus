import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { auditSkillsRoot, formatAuditReport } from "../src/audit.js";

describe("auditSkillsRoot", () => {
  it("scores well-structured skills and reports a readable summary", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "skill-sync-audit-good-"));
    await writeSkill(
      root,
      "research-pack",
      `---
name: research-pack
description: Use when an agent needs to collect source material and turn it into a brief.
---

# Research Pack

Use when the task requires source collection, evidence notes, and a short brief.

## Workflow

1. Gather the source material.
2. Extract the claims and references.
3. Produce a concise brief with open questions and follow-up actions.

## Output

Return a structured Markdown brief with sources, claims, risks, and next actions. Keep each section short enough for another agent to review quickly, but include enough detail that the original source files do not need to be reopened for routine follow-up work.
`
    );
    await mkdir(path.join(root, "research-pack", "templates"), { recursive: true });

    const report = await auditSkillsRoot(root);

    expect(report.summary.total).toBe(1);
    expect(report.skills[0]?.score).toBe(100);
    expect(formatAuditReport(report)).toContain("PASS research-pack - 100/100");
  });

  it("flags missing metadata, thin bodies, and missing referenced files", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "skill-sync-audit-bad-"));
    await writeSkill(
      root,
      "thin",
      `# Thin

Read scripts/missing.js.
`
    );

    const report = await auditSkillsRoot(root);
    const result = report.skills[0];

    expect(result?.score).toBeLessThan(60);
    expect(result?.issues.map((issue) => issue.code)).toContain("missing_frontmatter");
    expect(result?.issues.map((issue) => issue.code)).toContain("missing_description");
    expect(result?.issues.map((issue) => issue.code)).toContain("missing_referenced_file");
  });
});

async function writeSkill(root: string, id: string, skillMd: string): Promise<void> {
  const skillDir = path.join(root, id);
  await mkdir(skillDir, { recursive: true });
  await writeFile(path.join(skillDir, "SKILL.md"), skillMd, "utf8");
}
