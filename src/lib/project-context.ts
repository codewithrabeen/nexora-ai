import type { IProject } from "@/models/Project";
import type { Types } from "mongoose";

export type ProjectContextFile = {
  path: string;
  content: string;
};

export type ProjectContext = {
  projectId: string;
  projectName: string;
  description: string;
  framework: string;
  fileTree: string[];
  files: ProjectContextFile[];
};

const MAX_FILE_SIZE = 80_000;
const MAX_CONTEXT_SIZE = 180_000;

function isLikelyRelevant(
  file: ProjectContextFile,
  prompt: string
): boolean {
  const lowerPath = file.path.toLowerCase();
  const lowerPrompt = prompt.toLowerCase();

  const keywords = [
    "header",
    "navbar",
    "navigation",
    "hero",
    "footer",
    "about",
    "contact",
    "pricing",
    "testimonial",
    "testimonials",
    "feature",
    "features",
    "gallery",
    "menu",
    "product",
    "products",
    "login",
    "signup",
    "register",
    "dashboard",
    "button",
    "card",
    "form",
    "modal",
    "theme",
    "color",
    "style",
    "css",
    "layout",
  ];

  return keywords.some(
    (keyword) =>
      lowerPrompt.includes(keyword) &&
      lowerPath.includes(keyword)
  );
}

function prioritizeFiles(
  files: ProjectContextFile[],
  prompt: string
): ProjectContextFile[] {
  const prioritized: ProjectContextFile[] = [];
  const remaining: ProjectContextFile[] = [];

  for (const file of files) {
    if (isLikelyRelevant(file, prompt)) {
      prioritized.push(file);
    } else {
      remaining.push(file);
    }
  }

  return [...prioritized, ...remaining];
}

function trimFileContent(
  content: string
): string {
  if (content.length <= MAX_FILE_SIZE) {
    return content;
  }

  return `${content.slice(
    0,
    MAX_FILE_SIZE
  )}\n\n/* Content truncated by Nexora AI */`;
}

export function buildProjectContext(
  project: IProject,
  prompt: string
): ProjectContext {
  const files = project.files.map(
    (file) => ({
      path: file.path,
      content: file.content,
    })
  );

  const prioritized =
    prioritizeFiles(
      files,
      prompt
    );

  const selected: ProjectContextFile[] = [];

  let totalSize = 0;

  for (const file of prioritized) {
    const content =
      trimFileContent(
        file.content
      );

    const estimatedSize =
      file.path.length +
      content.length +
      50;

    if (
      selected.length > 0 &&
      totalSize + estimatedSize >
        MAX_CONTEXT_SIZE
    ) {
      continue;
    }

    selected.push({
      path: file.path,
      content,
    });

    totalSize += estimatedSize;
  }

  return {
     projectId: String(
  (project as IProject & { _id: Types.ObjectId })._id
),
    projectName:
      project.name,
    description:
      project.description,
    framework:
      project.framework,
    fileTree:
      files.map(
        (file) => file.path
      ),
    files: selected,
  };
}