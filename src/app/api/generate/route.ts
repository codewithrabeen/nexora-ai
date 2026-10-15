import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import { connectToDatabase } from "@/lib/mongodb";
import Project from "@/models/Project";

export const runtime = "nodejs";
export const maxDuration = 120;

const SYSTEM_PROMPT = `
You are Nexora AI, an advanced React website generator.

Your job is to generate a complete, polished, responsive website from the user's request.

Return ONLY valid JSON. Do not use Markdown fences.

Use exactly this structure:

{
  "name": "Website name",
  "description": "Short description",
  "files": [
    {
      "path": "src/App.jsx",
      "content": "..."
    },
    {
      "path": "src/index.css",
      "content": "..."
    }
  ]
}

IMPORTANT:

- Generate a REAL multi-file React project when the website benefits from multiple files.
- Do not put the entire website into one giant component.
- Create reusable components when appropriate.
- Use nested folders when useful.

Example structure:

src/App.jsx
src/index.css
src/components/Navbar.jsx
src/components/Hero.jsx
src/components/Footer.jsx
src/components/FeatureCard.jsx
src/pages/Home.jsx
src/utils/helpers.js

Rules:

1. Use React.
2. The main application must be exported as the default export from src/App.jsx.
3. Always include:
   - src/App.jsx
   - src/index.css
4. Create additional files when useful.
5. Components should be properly imported.
6. Every imported local file must actually exist in the returned files array.
7. Use relative imports correctly.
8. Do not reference files that were not generated.
9. Use semantic HTML.
10. Make the website responsive.
11. Make the design polished and production-quality.
12. Include realistic content based on the user's request.
13. Navigation should work where appropriate.
14. Use React state/hooks when interactive behavior is needed.
15. Use standard browser APIs when appropriate.
16. Do not generate backend code.
17. Do not generate environment variables.
18. Do not generate secrets or API keys.
19. Do not use external icon libraries.
20. Do not import lucide-react or react-icons.
21. When icons are needed, use inline SVG or simple text symbols.
22. Do not use undefined components.
23. Do not use undefined variables.
24. Every JSX component must either be defined or imported.
25. Keep code reasonably concise.
26. Avoid unnecessary duplication.
27. Make sure all JavaScript/JSX/CSS is syntactically valid.
28. Do not include explanations outside the JSON.

File rules:

- File paths must use forward slashes.
- File paths must be relative.
- Never use ".." in paths.
- Never use absolute paths.
- Common supported files include:
  .jsx
  .js
  .tsx
  .ts
  .css
  .json
  .svg
  .html
  .md
  .txt

You may create files inside:
- src/
- public/

Do not create:
- .env files
- secrets
- server code
- node_modules
- package-lock.json
- yarn.lock
- pnpm-lock.yaml

Prefer React components and CSS files over unnecessary configuration files.

If the website can reasonably be implemented with 3-10 files, use multiple files.

For a simple website, fewer files are acceptable.

Always return valid JSON.
`;

type GeneratedFile = {
  path: string;
  content: string;
};

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
  id?: string;
  usage?: unknown;
};

function extractContent(result: OpenRouterResponse): string {
  const content = result?.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .filter(
        (part): part is { text: string } =>
          typeof part?.text === "string"
      )
      .map((part) => part.text)
      .join("\n")
      .trim();
  }

  return "";
}


function cleanJsonResponse(content: string): string {
  return content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function isSafeProjectPath(path: string): boolean {
  if (!path) return false;

  if (path.startsWith("/")) return false;

  if (path.includes("..")) return false;

  if (path.includes("\\")) return false;

  const parts = path.split("/");

  if (parts.some((part) => !part || part === "." || part === "..")) {
    return false;
  }

  if (!path.startsWith("src/") && !path.startsWith("public/")) {
    return false;
  }

  return true;
}

function isSupportedFile(path: string): boolean {
  return /\.(jsx|tsx|js|ts|css|json|svg|html|md|txt)$/i.test(path);
}

function validateGeneratedFiles(files: unknown): GeneratedFile[] {
  if (!Array.isArray(files) || files.length < 2 || files.length > 30) {
    throw new Error(
      "The AI returned an invalid number of project files. Please try again."
    );
  }

  const validatedFiles: GeneratedFile[] = files.map((file: unknown) => {
    if (
      typeof file !== "object" ||
      file === null ||
      !("path" in file) ||
      !("content" in file) ||
      typeof file.path !== "string" ||
      typeof file.content !== "string"
    ) {
      throw new Error(
        "The AI returned an invalid project file."
      );
    }

    const path = file.path
      .replace(/\\/g, "/")
      .replace(/^\/+/, "");

    if (!isSafeProjectPath(path)) {
      throw new Error(
        `The AI returned an unsafe file path: ${path.slice(0, 120)}`
      );
    }

    if (!isSupportedFile(path)) {
      throw new Error(
        `The AI returned an unsupported file type: ${path.slice(0, 120)}`
      );
    }

    if (file.content.length > 200_000) {
      throw new Error(
        `The generated file is too large: ${path.slice(0, 120)}`
      );
    }

    return {
      path,
      content: file.content,
    };
  });

  const uniquePaths = new Set(
    validatedFiles.map((file) => file.path)
  );

  if (uniquePaths.size !== validatedFiles.length) {
    throw new Error(
      "The AI generated duplicate file paths. Please try again."
    );
  }

  if (
    !validatedFiles.some(
      (file) => file.path === "src/App.jsx"
    )
  ) {
    throw new Error(
      "The AI response is missing src/App.jsx."
    );
  }

  if (
    !validatedFiles.some(
      (file) => file.path === "src/index.css"
    )
  ) {
    throw new Error(
      "The AI response is missing src/index.css."
    );
  }

  return validatedFiles;
}

export async function POST(request: NextRequest) {
  let projectId: string | undefined;
  let projectStartedGenerating = false;

  try {
    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("projectId" in body) ||
      typeof body.projectId !== "string" ||
      !mongoose.isValidObjectId(body.projectId)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "A valid projectID is required.",
        },
        { status: 400 }
      );
    }

    projectId = body.projectId;

    await connectToDatabase();

    const project = await Project.findById(projectId);

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          message: "Project not found.",
        },
        { status: 404 }
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          message: "OpenRouter API key is missing.",
        },
        { status: 500 }
      );
    }

    project.status = "generating";
    await project.save();

    projectStartedGenerating = true;

    const model =
      process.env.OPENROUTER_MODEL ||
      "openrouter/free";

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-OpenRouter-Title": "Nexora AI",
        },

        body: JSON.stringify({
          model,

          messages: [
            {
              role: "system",
              content: SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: project.prompt,
            },
          ],

          reasoning: {
            effort: "none",
            exclude: true,
          },

          temperature: 0.3,

          max_tokens: 20000,
        }),

        signal: AbortSignal.timeout(120000),
      }
    );

    const responseText = await response.text();

    let result: OpenRouterResponse;

    try {
      result = JSON.parse(responseText);
    } catch {
      console.error(
        "OpenRouter returned a non-JSON response.",
        {
          status: response.status,
          model,
        }
      );

      throw new Error(
        "OpenRouter returned an unexpected response. Please try again."
      );
    }

    if (!response.ok) {
      const providerMessage =
        typeof result?.error?.message === "string"
          ? result.error.message
          : `Request failed with status ${response.status}.`;

      console.error(
        "OpenRouter request failed.",
        {
          status: response.status,
          model,
          message: providerMessage,
        }
      );

      throw new Error(
        `AI provider error: ${providerMessage}`
      );
    }

    const content = extractContent(result);

    if (!content) {
      throw new Error(
        "The selected AI model returned no website code. Please try again."
      );
    }

    let generated: {
      name?: unknown;
      description?: unknown;
      files?: unknown;
    };

    try {
      generated = JSON.parse(
        cleanJsonResponse(content)
      );
    } catch {
      console.error(
        "OpenRouter returned invalid JSON.",
        {
          model,
          finishReason:
            result?.choices?.[0]?.finish_reason,
          responseId: result?.id,
          contentLength: content.length,
        }
      );

      throw new Error(
        "The AI response was incomplete or invalid. Please generate the website again."
      );
    }

    const files = validateGeneratedFiles(
      generated.files
    );

    project.name =
      typeof generated.name === "string" &&
      generated.name.trim()
        ? generated.name.trim().slice(0, 100)
        : project.name;

    project.description =
      typeof generated.description === "string"
        ? generated.description
            .trim()
            .slice(0, 500)
        : "AI-generated website";

    project.files = files;

    project.status = "ready";

    await project.save();

    return NextResponse.json({
      success: true,
      message:
        "Website generated and saved successfully.",
      project,
    });
  } catch (error) {
    console.error(
      "Website generation failed:",
      error
    );

    if (
      projectId &&
      projectStartedGenerating
    ) {
      try {
        await connectToDatabase();

        await Project.findByIdAndUpdate(
          projectId,
          {
            $set: {
              status: "error",
            },
          }
        );
      } catch (statusError) {
        console.error(
          "Could not update project status:",
          statusError
        );
      }
    }

    const message =
      error instanceof Error
        ? error.name === "TimeoutError" ||
          error.name === "AbortError"
          ? "The AI request timed out. Please try again."
          : error.message
        : "Website generation failed. Please try again.";

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}