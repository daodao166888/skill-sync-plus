import { existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { ScanSource } from "./types.js";

export type AuditSeverity = "error" | "warning" | "info";

export type SkillAuditIssue = {
  severity: AuditSeverity;
  code: string;
  message: string;
  suggestion: string;
};

export type SkillAuditResult = {
  id: string;
  path: string;
  source: ScanSource;
  score: number;
  frontmatter: {
    name: string | null;
    description: string | null;
  };
  issueCount: {
    errors: number;
    warnings: number;
    info: number;
  };
  issues: SkillAuditIssue[];
};

export type SkillsAuditReport = {
  root: string;
  source: ScanSource;
  generatedAt: string;
  summary: {
    total: number;
    averageScore: number;
    pass: number;
    warn: number;
    fail: number;
  };
  skills: SkillAuditResult[];
};

type ParsedSkillFile = {
  frontmatter: Record<string, string>;
  body: string;
};

const REQUIRED_SUPPORT_DIRS = ["scripts", "templates", "assets", "examples", "references"];

export async function auditSkillsRoot(root: string, source: ScanSource = "codex"): Promise<SkillsAuditReport> {
  const resolvedRoot = path.resolve(root);
  const skills = existsSync(resolvedRoot) ? await findSkillDirs(resolvedRoot) : [];
  const results = await Promise.all(skills.map((skillDir) => auditSkillDir(resolvedRoot, skillDir, source)));
  const sorted = results.sort((a, b) => a.id.localeCompare(b.id));
  const totalScore = sorted.reduce((sum, skill) => sum + skill.score, 0);

  return {
    root: resolvedRoot,
    source,
    generatedAt: new Date().toISOString(),
    summary: {
      total: sorted.length,
      averageScore: sorted.length === 0 ? 0 : Math.round(totalScore / sorted.length),
      pass: sorted.filter((skill) => skill.score >= 85).length,
      warn: sorted.filter((skill) => skill.score >= 60 && skill.score < 85).length,
      fail: sorted.filter((skill) => skill.score < 60).length
    },
    skills: sorted
  };
}

export async function auditSkillDir(root: string, skillDir: string, source: ScanSource = "codex"): Promise<SkillAuditResult> {
  const skillFile = path.join(skillDir, "SKILL.md");
  const raw = await readFile(skillFile, "utf8");
  const parsed = parseSkillFile(raw);
  const issues = await collectIssues(skillDir, raw, parsed);
  const score = Math.max(0, 100 - issues.reduce((sum, issue) => sum + issuePenalty(issue), 0));

  return {
    id: path.relative(root, skillDir).split(path.sep).join("/"),
    path: skillDir,
    source,
    score,
    frontmatter: {
      name: parsed.frontmatter.name ?? null,
      description: parsed.frontmatter.description ?? null
    },
    issueCount: {
      errors: issues.filter((issue) => issue.severity === "error").length,
      warnings: issues.filter((issue) => issue.severity === "warning").length,
      info: issues.filter((issue) => issue.severity === "info").length
    },
    issues
  };
}

export function formatAuditReport(report: SkillsAuditReport, minScore = 0): string {
  const skills = report.skills.filter((skill) => skill.score >= minScore);
  const lines = [
    `Skill audit: ${report.root}`,
    `Skills: ${report.summary.total} | Average score: ${report.summary.averageScore} | Pass: ${report.summary.pass} | Warn: ${report.summary.warn} | Fail: ${report.summary.fail}`
  ];

  if (skills.length === 0) {
    lines.push("", "No skills matched the current filter.");
    return lines.join("\n");
  }

  for (const skill of skills) {
    lines.push("", `${gradeForScore(skill.score)} ${skill.id} - ${skill.score}/100`);
    if (skill.issues.length === 0) {
      lines.push("  No issues found.");
      continue;
    }

    for (const issue of skill.issues) {
      lines.push(`  [${issue.severity}] ${issue.code}: ${issue.message}`);
      lines.push(`    Fix: ${issue.suggestion}`);
    }
  }

  return lines.join("\n");
}

async function findSkillDirs(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const dirs: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules") {
      continue;
    }

    const candidate = path.join(root, entry.name);
    if (existsSync(path.join(candidate, "SKILL.md"))) {
      dirs.push(candidate);
    }
  }

  return dirs;
}

async function collectIssues(skillDir: string, raw: string, parsed: ParsedSkillFile): Promise<SkillAuditIssue[]> {
  const issues: SkillAuditIssue[] = [];
  const name = parsed.frontmatter.name?.trim() ?? "";
  const description = parsed.frontmatter.description?.trim() ?? "";
  const body = parsed.body.trim();

  if (!raw.startsWith("---")) {
    issues.push(error("missing_frontmatter", "SKILL.md is missing YAML frontmatter.", "Add a frontmatter block with name and description."));
  }

  if (!name) {
    issues.push(error("missing_name", "Frontmatter is missing a name.", "Add a short, human-readable name field."));
  }

  if (!description) {
    issues.push(error("missing_description", "Frontmatter is missing a description.", "Add a concise description that tells agents when to use the skill."));
  } else if (description.length < 24) {
    issues.push(warning("short_description", "Description is too short to be discoverable.", "Expand it to include the task, trigger context, and outcome."));
  } else if (description.length > 300) {
    issues.push(warning("long_description", "Description is long enough to be hard to scan.", "Keep the description under 300 characters and move details into the body."));
  }

  if (!/^#\s+\S+/m.test(body)) {
    issues.push(warning("missing_title", "Skill body does not start with a clear Markdown title.", "Add a top-level heading that matches the skill purpose."));
  }

  if (!/use when|when to use|trigger|workflow|steps|process/i.test(body)) {
    issues.push(warning("weak_activation_guidance", "Skill body lacks explicit activation or workflow guidance.", "Add a short 'Use when' or workflow section so agents know when and how to apply it."));
  }

  if (body.length < 300) {
    issues.push(warning("thin_body", "Skill body is very short.", "Add enough workflow detail, constraints, and examples for repeatable execution."));
  } else if (body.length > 16000) {
    issues.push(info("large_body", "Skill body is large and may be expensive to load.", "Move detailed references into separate files and link to them from SKILL.md."));
  }

  if (await hasReferencedMissingPaths(skillDir, body)) {
    issues.push(error("missing_referenced_file", "Skill body references local files or folders that do not exist.", "Create the referenced assets or update the paths."));
  }

  if (!(await hasSupportingMaterial(skillDir))) {
    issues.push(info("no_supporting_material", "No scripts, templates, examples, assets, or references directory found.", "Add supporting files when the workflow benefits from reusable assets or executable helpers."));
  }

  return issues;
}

function parseSkillFile(raw: string): ParsedSkillFile {
  if (!raw.startsWith("---")) {
    return { frontmatter: {}, body: raw };
  }

  const end = raw.indexOf("\n---", 3);
  if (end === -1) {
    return { frontmatter: {}, body: raw };
  }

  const block = raw.slice(3, end).trim();
  const frontmatter: Record<string, string> = {};
  for (const line of block.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) {
      continue;
    }

    frontmatter[match[1]] = stripYamlString(match[2]);
  }

  return { frontmatter, body: raw.slice(end + 4) };
}

async function hasReferencedMissingPaths(skillDir: string, body: string): Promise<boolean> {
  const references = Array.from(body.matchAll(/(?:^|\s)(?:\.\/)?((?:scripts|templates|assets|examples|references)\/[A-Za-z0-9._/-]+)/g)).map((match) => match[1]);
  for (const reference of references) {
    if (!existsSync(path.join(skillDir, reference))) {
      return true;
    }
  }

  return false;
}

async function hasSupportingMaterial(skillDir: string): Promise<boolean> {
  for (const dir of REQUIRED_SUPPORT_DIRS) {
    const candidate = path.join(skillDir, dir);
    if (existsSync(candidate) && (await stat(candidate)).isDirectory()) {
      return true;
    }
  }

  return false;
}

function stripYamlString(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function issuePenalty(issue: SkillAuditIssue): number {
  if (issue.severity === "error") {
    return 25;
  }

  if (issue.severity === "warning") {
    return 12;
  }

  return 4;
}

function gradeForScore(score: number): string {
  if (score >= 85) {
    return "PASS";
  }

  if (score >= 60) {
    return "WARN";
  }

  return "FAIL";
}

function error(code: string, message: string, suggestion: string): SkillAuditIssue {
  return { severity: "error", code, message, suggestion };
}

function warning(code: string, message: string, suggestion: string): SkillAuditIssue {
  return { severity: "warning", code, message, suggestion };
}

function info(code: string, message: string, suggestion: string): SkillAuditIssue {
  return { severity: "info", code, message, suggestion };
}
