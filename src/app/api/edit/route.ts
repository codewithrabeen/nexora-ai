
import { buildProjectContext } from "@/lib/project-context";

import { NextRequest, NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/mongodb";
import Project from "@/models/Project";

type OpenRouterContentPart = {
  text?: unknown;
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string | OpenRouterContentPart[];
    };
    finish_reason?: string;
  }>;
  error?: {
    message?: string;
  };
};

type ProjectFile = {
  path: string;
  content: string;
};

type EditChange = {
  path: string;
  action: "create" | "update" | "delete";
  content?: string;
};

type EditResponse = {
  changes?: EditChange[];
  summary?: string;
};

const MAX_FILES = 50;
const MAX_FILE_CONTENT = 200_000;
const MAX_PROMPT_LENGTH = 10_000;

const ALLOWED_EXTENSIONS = [
  ".jsx",
  ".tsx",
  ".js",
  ".ts",
  ".css",
  ".scss",
  ".json",
  ".svg",
  ".html",
  ".md",
  ".txt",
];

function isValidPath(path: string): boolean {
  if (!path || path.length > 200) {
    return false;
  }

  if (
    path.includes("..") ||
    path.includes("\\") ||
    path.includes("\0") ||
    path.startsWith("/")
  ) {
    return false;
  }

  const extension = path.includes(".")
    ? path.slice(path.lastIndexOf(".")).toLowerCase()
    : "";

  return ALLOWED_EXTENSIONS.includes(extension);
}

function extractContent(
  result: OpenRouterResponse
): string {
  const content =
    result?.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .filter(
        (
          part
        ): part is { text: string } =>
          typeof part?.text === "string"
      )
      .map((part) => part.text)
      .join("\n")
      .trim();
  }

  return "";
}

function cleanJsonResponse(
  content: string
): string {
  let cleaned = content.trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }

  return cleaned;
}

function validateChanges(
  changes: unknown
): EditChange[] {
  if (!Array.isArray(changes)) {
    throw new Error(
      "AI returned an invalid changes list."
    );
  }

  if (changes.length > MAX_FILES) {
    throw new Error(
      `AI returned too many file changes. Maximum is ${MAX_FILES}.`
    );
  }

  const result: EditChange[] = [];
  const paths = new Set<string>();

  for (const change of changes) {
    if (
      !change ||
      typeof change !== "object"
    ) {
      throw new Error(
        "AI returned an invalid file change."
      );
    }

    const candidate =
      change as Record<string, unknown>;

    if (
      typeof candidate.path !==
        "string" ||
      typeof candidate.action !==
        "string"
    ) {
      throw new Error(
        "Every change must contain a path and action."
      );
    }

    const path =
      candidate.path.trim();

    const action =
      candidate.action;

    if (!isValidPath(path)) {
      throw new Error(
        `AI returned an invalid file path: ${path}`
      );
    }

    if (
      action !== "create" &&
      action !== "update" &&
      action !== "delete"
    ) {
      throw new Error(
        `Invalid file action for ${path}.`
      );
    }

    if (paths.has(path)) {
      throw new Error(
        `Duplicate file change: ${path}`
      );
    }

    paths.add(path);

    if (
      action === "delete"
    ) {
      result.push({
        path,
        action,
      });

      continue;
    }

    if (
      typeof candidate.content !==
      "string"
    ) {
      throw new Error(
        `Missing content for ${path}.`
      );
    }

    if (
      candidate.content.length >
      MAX_FILE_CONTENT
    ) {
      throw new Error(
        `File "${path}" is too large.`
      );
    }

    result.push({
      path,
      action,
      content:
        candidate.content,
    });
  }

  return result;
}

function applyChanges(
  currentFiles: ProjectFile[],
  changes: EditChange[]
): ProjectFile[] {
  const fileMap = new Map<string, string>();

  for (const file of currentFiles) {
    fileMap.set(
      file.path,
      file.content
    );
  }

  for (const change of changes) {
    if (
      change.action ===
      "delete"
    ) {
      fileMap.delete(
        change.path
      );
      continue;
    }

    fileMap.set(
      change.path,
      change.content ?? ""
    );
  }

  return Array.from(
    fileMap.entries()
  ).map(
    ([path, content]) => ({
      path,
      content,
    })
  );
}

export async function POST(
  request: NextRequest
) {
  try {
    const body: unknown =
      await request.json();

    if (
      !body ||
      typeof body !== "object"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Request body must be an object.",
        },
        { status: 400 }
      );
    }

    const requestBody =
      body as Record<
        string,
        unknown
      >;

    const projectId =
      requestBody.projectId;

    const prompt =
      requestBody.prompt;

    if (
      typeof projectId !==
        "string" ||
      !projectId
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Project ID is required.",
        },
        { status: 400 }
      );
    }

    if (
      typeof prompt !==
        "string"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Edit prompt is required.",
        },
        { status: 400 }
      );
    }

    const cleanPrompt =
      prompt.trim();

    if (!cleanPrompt) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Edit prompt cannot be empty.",
        },
        { status: 400 }
      );
    }

    if (
      cleanPrompt.length >
      MAX_PROMPT_LENGTH
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Edit prompt is too long.",
        },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const project =
      await Project.findById(
        projectId
      );

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Project not found.",
        },
        { status: 404 }
      );
    }

const currentFiles =
  project.files.map(
    (file) => ({
      path: file.path,
      content: file.content,
    })
  );

const projectContext =
  buildProjectContext(
    project,
    cleanPrompt
  );

const fileContext =
  projectContext.files
    .map(
      (file) =>
        `\n===== FILE: ${file.path} =====\n${file.content}\n===== END FILE =====`
    )
    .join("\n");

    const systemPrompt = `
You are Nexora AI, an expert frontend engineer modifying an existing React website.

The user wants to change an existing project.

Your job is to return ONLY valid JSON.

You must return this exact structure:

{
  "summary": "Short description of what you changed",
  "changes": [
    {
      "path": "src/example.jsx",
      "action": "create",
      "content": "complete file content"
    }
  ]
}

Allowed actions:
- create: create a new file
- update: replace the complete contents of an existing file
- delete: delete an existing file

IMPORTANT RULES:

1. Preserve the existing design unless the user explicitly asks for a redesign.

2. Make the smallest reasonable set of file changes.

3. Do NOT rewrite unrelated files.
2A. For simple UI changes, normally modify only 1-3 files.

2B. Do not return unchanged files.

2C. Do not recreate the entire project.

2D. Prefer modifying an existing component instead of creating a new component when practical.

2E. Keep generated code concise and production-ready.

2F. Never return placeholder files or duplicate copies of existing files.

4. When updating a file, return its COMPLETE contents.

5. When creating a file, return its COMPLETE contents.

6. For deleting a file, omit "content".

7. Use valid relative project paths.

8. Never use paths containing "..".

9. Never create backend files, environment files, secrets, or server code.

10. Never use absolute paths.

11. Use React-compatible JSX/JavaScript/TypeScript/CSS.

12. Preserve existing imports and functionality whenever possible.

13. If a new component is required, create it under src/components/.

14. If you create a component, update the appropriate existing file to import and use it.

15. Do not invent nonexistent files. Use the provided project files.

16. Do not use markdown code fences.

17. Return JSON only.

18. Do not explain your answer outside the JSON.

19. The generated project should remain runnable.

20. Do not remove existing functionality unless the user explicitly asks for it.

PROJECT INFORMATION:

Project name:
${projectContext.projectName}

Description:
${projectContext.description}

Framework:
${projectContext.framework}

PROJECT FILE TREE:
${projectContext.fileTree
  .map((path) => `- ${path}`)
  .join("\n")}

RELEVANT PROJECT FILES:
${fileContext}

USER REQUEST:
${cleanPrompt}
`.trim();

    const apiKey =
      process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          message:
            "OPENROUTER_API_KEY is not configured.",
        },
        { status: 500 }
      );
    }

   const model =
  process.env.OPENROUTER_EDIT_MODEL ||
  "nvidia/nemotron-3-nano-30b-a3b";

    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () => controller.abort(),
        90_000
      );

    let result:
      OpenRouterResponse;

    try {
      const response =
        await fetch(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type":
                "application/json",
              "HTTP-Referer":
                "http://localhost:3000",
              "X-Title":
                "Nexora AI",
            },
            body: JSON.stringify({
              model,
              messages: [
                {
                  role: "system",
                  content:
                    systemPrompt,
                },
              ],
              temperature: 0.2,
              max_tokens: 8_000,
            }),
            signal:
              controller.signal,
          }
        );

      const responseText =
        await response.text();

      let parsed: unknown;

      try {
        parsed =
          JSON.parse(
            responseText
          );
      } catch {
        throw new Error(
          "OpenRouter returned an invalid response."
        );
      }

      result =
        parsed as OpenRouterResponse;

      if (!response.ok) {
  console.error(
    "========== OPENROUTER EDIT ERROR =========="
  );

  console.error(
    "HTTP status:",
    response.status
  );

  console.error(
    "Response:",
    JSON.stringify(
      result,
      null,
      2
    )
  );

  console.error(
    "==========================================="
  );

  throw new Error(
    result.error?.message ||
      `OpenRouter request failed with status ${response.status}.`
  );
}
    } finally {
      clearTimeout(timeout);
    }

    const content =
      extractContent(result);

    if (!content) {
      return NextResponse.json(
        {
          success: false,
          message:
            "AI returned an empty response.",
        },
        { status: 502 }
      );
    }

    let parsedEdit:
      EditResponse;

    try {
      const cleaned =
        cleanJsonResponse(
          content
        );

      parsedEdit =
        JSON.parse(
          cleaned
        ) as EditResponse;
    } catch (parseError) {
      console.error(
        "Failed to parse AI edit response:",
        parseError,
        content
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "AI returned invalid JSON. Please try the request again.",
        },
        { status: 502 }
      );
    }

    const changes =
      validateChanges(
        parsedEdit.changes
      );

    if (
      changes.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The AI did not return any file changes.",
        },
        { status: 502 }
      );
    }

    const updatedFiles =
      applyChanges(
        currentFiles,
        changes
      );

    if (
      updatedFiles.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The edit would leave the project without any files.",
        },
        { status: 400 }
      );
    }

if (updatedFiles.length > MAX_FILES) {
  return NextResponse.json(
    {
      success: false,
      message:
        `The edited project would contain more than ${MAX_FILES} files.`,
    },
    { status: 400 }
  );
}

const nextVersionNumber =
  project.versions.length > 0
    ? project.versions[project.versions.length - 1].version + 1
    : 1;
const snapshot = {
  version: nextVersionNumber,
  label:
    parsedEdit.summary ||
    `AI edit ${nextVersionNumber}`,
  files: currentFiles.map(
    (file) => ({
      path: file.path,
      content: file.content,
    })
  ),
  createdAt: new Date(),
};

project.versions.push(snapshot);
const MAX_VERSIONS = 20;

if (project.versions.length > MAX_VERSIONS) {
  project.versions = project.versions.slice(-MAX_VERSIONS);
}

    project.files =
      updatedFiles;

    project.status =
      "ready";

    await project.save();

    return NextResponse.json({
      success: true,
      message:
        "AI changes applied successfully.",
      summary:
        parsedEdit.summary ||
        "The AI updated your project.",
      changes,
      project:
        project.toObject(),
    });
  } catch (error) {
    console.error(
      "POST /api/edit error:",
      error
    );

    if (
      error instanceof Error &&
      error.name ===
        "AbortError"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "AI editing timed out. Please try again.",
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "AI editing failed.",
      },
      { status: 500 }
    );
  }
}