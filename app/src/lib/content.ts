import fs from 'node:fs';
import path from 'node:path';

import matter from 'gray-matter';

/**
 * Reads HAI's enablement content (playbooks and guides). Server-only — every
 * export here does filesystem I/O and must not be imported from a Client
 * Component.
 *
 * The canonical copy is `content/` at the repository root, one level above this
 * Next.js project, and that is what a repo-root build reads. A deploy made from
 * `app/` cannot reach it: only `app/` is uploaded, so nothing above it exists at
 * build time. `app/content/` is a vendored copy for exactly that case, and it
 * wins when present.
 *
 * The cost of this is a second copy that has to be kept in step with the root
 * one; the alternative was for the deployed site to silently lose its guides and
 * playbooks. If the Vercel project's Root Directory is ever set to `app`, or
 * deploys move back to the repository root for good, one of the two copies
 * should go — see docs/DEPLOY.md.
 *
 * `next.config.ts` declares the content directory via `outputFileTracingIncludes`
 * for the routes that read it; otherwise a build would trace only files under
 * `src/` and ship without it.
 */

const VENDORED_CONTENT_DIR = path.join(process.cwd(), 'content');
const CONTENT_DIR = fs.existsSync(VENDORED_CONTENT_DIR)
  ? VENDORED_CONTENT_DIR
  : path.join(process.cwd(), '..', 'content');
const PLAYBOOKS_DIR = path.join(CONTENT_DIR, 'playbooks');
const GUIDES_DIR = path.join(CONTENT_DIR, 'guides');

export interface PlaybookIndexEntry {
  id: string;
  title: string;
  role: string;
  summary: string;
  file: string;
}

export interface PlaybookExample {
  number: number;
  level: string;
  prompt: string;
  why: string;
}

export interface Playbook {
  id: string;
  title: string;
  role: string;
  icon: string;
  skillLevels: string[];
  summary: string;
  /** Markdown from the title through "Where AI should NOT be used". */
  intro: string;
  examples: PlaybookExample[];
  /** Markdown from "## Verify before you act" to the end of the file. */
  outro: string;
}

export interface GuideIndexEntry {
  id: string;
  title: string;
  summary: string;
  skillLevels: string[];
}

export interface Guide {
  id: string;
  title: string;
  summary: string;
  skillLevels: string[];
  body: string;
}

const EXAMPLE_HEADING = '## Example prompts';
const VERIFY_HEADING = '## Verify before you act';
const EXAMPLE_ENTRY_RE =
  /\*\*(\d+)\.\s*\(([^)]+)\)\*\*\s*"([^"]+)"\s*\n\*Why it works:\s*([^\n]+)\*/g;

function parseExamples(block: string): PlaybookExample[] {
  return [...block.matchAll(EXAMPLE_ENTRY_RE)].map((match) => ({
    number: Number(match[1]),
    level: match[2].trim(),
    prompt: match[3].trim(),
    why: match[4].trim(),
  }));
}

function splitPlaybookBody(body: string): {
  intro: string;
  examples: PlaybookExample[];
  outro: string;
} {
  const exampleStart = body.indexOf(EXAMPLE_HEADING);
  const verifyStart = body.indexOf(VERIFY_HEADING);

  if (exampleStart === -1 || verifyStart === -1) {
    // Malformed playbook (missing an expected section) — fail soft by
    // rendering the whole body and skipping interactive examples rather
    // than throwing during a page render.
    return { intro: body.trim(), examples: [], outro: '' };
  }

  return {
    intro: body.slice(0, exampleStart).trim(),
    examples: parseExamples(body.slice(exampleStart, verifyStart)),
    outro: body.slice(verifyStart).trim(),
  };
}

export function getPlaybookIndex(): PlaybookIndexEntry[] {
  const raw = fs.readFileSync(path.join(PLAYBOOKS_DIR, 'index.json'), 'utf-8');
  return JSON.parse(raw) as PlaybookIndexEntry[];
}

export function getPlaybookIcons(): Record<string, string> {
  const icons: Record<string, string> = {};
  for (const entry of getPlaybookIndex()) {
    const { data } = matter(fs.readFileSync(path.join(PLAYBOOKS_DIR, entry.file), 'utf-8'));
    icons[entry.id] = (data.icon as string) ?? '📄';
  }
  return icons;
}

export function getPlaybook(id: string): Playbook | null {
  const entry = getPlaybookIndex().find((item) => item.id === id);
  if (!entry) return null;

  const filePath = path.join(PLAYBOOKS_DIR, entry.file);
  if (!fs.existsSync(filePath)) return null;

  const { data, content } = matter(fs.readFileSync(filePath, 'utf-8'));
  const { intro, examples, outro } = splitPlaybookBody(content);

  return {
    id: entry.id,
    title: (data.title as string) ?? entry.title,
    role: (data.role as string) ?? entry.role,
    icon: (data.icon as string) ?? '📄',
    skillLevels: (data.skill_levels as string[]) ?? [],
    summary: (data.summary as string) ?? entry.summary,
    intro,
    examples,
    outro,
  };
}

export function getAllPlaybookIds(): string[] {
  return getPlaybookIndex().map((entry) => entry.id);
}

export function getGuideIndex(): GuideIndexEntry[] {
  return fs
    .readdirSync(GUIDES_DIR)
    .filter((file) => file.endsWith('.md'))
    .map((file) => {
      const { data } = matter(fs.readFileSync(path.join(GUIDES_DIR, file), 'utf-8'));
      return {
        id: (data.id as string) ?? file.replace(/\.md$/, ''),
        title: data.title as string,
        summary: data.summary as string,
        skillLevels: (data.skill_levels as string[]) ?? [],
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function getGuide(id: string): Guide | null {
  const filePath = path.join(GUIDES_DIR, `${id}.md`);
  if (!fs.existsSync(filePath)) return null;

  const { data, content } = matter(fs.readFileSync(filePath, 'utf-8'));

  return {
    id: (data.id as string) ?? id,
    title: data.title as string,
    summary: data.summary as string,
    skillLevels: (data.skill_levels as string[]) ?? [],
    body: content.trim(),
  };
}

export function getAllGuideIds(): string[] {
  return fs
    .readdirSync(GUIDES_DIR)
    .filter((file) => file.endsWith('.md'))
    .map((file) => file.replace(/\.md$/, ''));
}
