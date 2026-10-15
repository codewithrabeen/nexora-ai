import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import { connectToDatabase } from "@/lib/mongodb";
import Project from "@/models/Project";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type IncomingFile = {
  path: string;
  content: string;
};

const MAX_FILES = 50;
const MAX_FILE_CONTENT = 200_000;
const MAX_PATH_LENGTH = 200;

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

function isValidFilePath(filePath: string): boolean {
  if (!filePath || filePath.length > MAX_PATH_LENGTH) {
    return false;
  }

  if (filePath.includes("..")) {
    return false;
  }

  if (filePath.startsWith("/")) {
    return false;
  }

  if (filePath.includes("\\") || filePath.includes("\0")) {
    return false;
  }

  const normalizedPath = filePath.replace(/^\/+/, "");

  if (!normalizedPath) {
    return false;
  }

  const extension = normalizedPath.includes(".")
    ? normalizedPath.slice(normalizedPath.lastIndexOf(".")).toLowerCase()
    : "";

  return ALLOWED_EXTENSIONS.includes(extension);
}

function validateFiles(files: unknown): {
  valid: boolean;
  message?: string;
  files?: IncomingFile[];
} {
  if (!Array.isArray(files)) {
    return {
      valid: false,
      message: "Files must be an array.",
    };
  }

  if (files.length === 0) {
    return {
      valid: false,
      message: "A project must contain at least one file.",
    };
  }

  if (files.length > MAX_FILES) {
    return {
      valid: false,
      message: `A project can contain at most ${MAX_FILES} files.`,
    };
  }

  const normalizedFiles: IncomingFile[] = [];
  const paths = new Set<string>();

  for (const file of files) {
    if (!file || typeof file !== "object") {
      return {
        valid: false,
        message: "Each file must be an object.",
      };
    }

    const candidate = file as Record<string, unknown>;

    if (
      typeof candidate.path !== "string" ||
      typeof candidate.content !== "string"
    ) {
      return {
        valid: false,
        message: "Each file must contain a string path and content.",
      };
    }

    const path = candidate.path.trim();

    if (!isValidFilePath(path)) {
      return {
        valid: false,
        message: `Invalid file path: ${candidate.path}`,
      };
    }

    if (candidate.content.length > MAX_FILE_CONTENT) {
      return {
        valid: false,
        message: `File "${path}" is too large. Maximum size is ${MAX_FILE_CONTENT} characters.`,
      };
    }

    if (paths.has(path)) {
      return {
        valid: false,
        message: `Duplicate file path: ${path}`,
      };
    }

    paths.add(path);

    normalizedFiles.push({
      path,
      content: candidate.content,
    });
  }

  return {
    valid: true,
    files: normalizedFiles,
  };
}

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid project ID.",
        },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const project = await Project.findById(id).lean();

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          message: "Project not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      project,
    });
  } catch (error) {
    console.error("GET /api/projects/[id] error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load project.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid project ID.",
        },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const existingProject = await Project.findById(id);

    if (!existingProject) {
      return NextResponse.json(
        {
          success: false,
          message: "Project not found.",
        },
        { status: 404 }
      );
    }

    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          success: false,
          message: "Request body must be an object.",
        },
        { status: 400 }
      );
    }

    const requestBody = body as Record<string, unknown>;

    const validation = validateFiles(requestBody.files);

    if (!validation.valid || !validation.files) {
      return NextResponse.json(
        {
          success: false,
          message: validation.message ?? "Invalid project files.",
        },
        { status: 400 }
      );
    }

    existingProject.files = validation.files;

    await existingProject.save();

    return NextResponse.json({
      success: true,
      message: "Project files saved successfully.",
      project: existingProject.toObject(),
    });
  } catch (error) {
    console.error("PUT /api/projects/[id] error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to save project.",
      },
      { status: 500 }
    );
  }
}
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid project ID.",
        },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const deletedProject = await Project.findByIdAndDelete(id);

    if (!deletedProject) {
      return NextResponse.json(
        {
          success: false,
          message: "Project not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Project deleted successfully.",
      projectId: id,
    });
  } catch (error) {
    console.error("DELETE /api/projects/[id] error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete project.",
      },
      { status: 500 }
    );
  }
}