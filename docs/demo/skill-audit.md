# Skill Audit Demo

This demo shows the new `skill-sync audit` command scanning two local skills before they are synced or published.

## Command

```bash
skill-sync audit ./demo-skills
```

## Output

```text
Skill audit: /Users/me/demo-skills
Skills: 2 | Average score: 61 | Pass: 1 | Warn: 0 | Fail: 1

PASS research-pack - 100/100
  No issues found.

FAIL thin - 22/100
  [error] missing_frontmatter: SKILL.md is missing YAML frontmatter.
    Fix: Add a frontmatter block with name and description.
  [error] missing_name: Frontmatter is missing a name.
    Fix: Add a short, human-readable name field.
  [error] missing_description: Frontmatter is missing a description.
    Fix: Add a concise description that tells agents when to use the skill.
  [warning] weak_activation_guidance: Skill body lacks explicit activation or workflow guidance.
    Fix: Add a short 'Use when' or workflow section so agents know when and how to apply it.
  [warning] thin_body: Skill body is very short.
    Fix: Add enough workflow detail, constraints, and examples for repeatable execution.
  [error] missing_referenced_file: Skill body references local files or folders that do not exist.
    Fix: Create the referenced assets or update the paths.
  [info] no_supporting_material: No scripts, templates, examples, assets, or references directory found.
    Fix: Add supporting files when the workflow benefits from reusable assets or executable helpers.
```

## Why It Helps

Agents choose skills largely from short descriptions and then follow `SKILL.md` instructions. A weak description, vague workflow, or missing helper file can make a skill hard to discover or unreliable at execution time.

The audit command turns those failure modes into a quick local checklist that can run before a skill is synced, shared, or published.
