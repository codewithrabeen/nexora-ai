import { NextRequest, NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/mongodb";
import Project from "@/models/Project";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function isValidObjectId(id: string): boolean {
  return /^[a-f\d]{24}$/i.test(id);
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!isValidObjectId(id)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid project ID.",
        },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const project = await Project.findById(id).select("name versions");

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          message: "Project not found.",
        },
        { status: 404 },
      );
    }

    const versions = [...(project.versions ?? [])].reverse().map((version) => ({
      version: version.version,
      label: version.label,
      createdAt: version.createdAt,
      fileCount: version.files.length,
    }));

    return NextResponse.json({
      success: true,
      versions,
    });
  } catch (error) {
    console.error("GET /api/projects/[id]/history error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load project history.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!isValidObjectId(id)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid project ID.",
        },
        { status: 400 },
      );
    }

    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          success: false,
          message: "Request body must be an object.",
        },
        { status: 400 },
      );
    }

    const requestBody = body as Record<string, unknown>;

    const version = requestBody.version;

    if (
      typeof version !== "number" ||
      !Number.isInteger(version) ||
      version < 1
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "A valid version number is required.",
        },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const project = await Project.findById(id);

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          message: "Project not found.",
        },
        { status: 404 },
      );
    }

    const targetVersion = project.versions.find(
      (item) => item.version === version,
    );

    if (!targetVersion) {
      return NextResponse.json(
        {
          success: false,
          message: `Version ${version} was not found.`,
        },
        { status: 404 },
      );
    }

    /*
     * Save the current project as a new
     * snapshot before restoring an older one.
     *
     * This means Restore itself is reversible.
     */
    const nextVersionNumber =
      project.versions.length > 0
        ? project.versions[project.versions.length - 1].version + 1
        : 1;

    project.versions.push({
      version: nextVersionNumber,
      label: `Before restoring version ${version}`,
      files: project.files.map((file) => ({
        path: file.path,
        content: file.content,
      })),
      createdAt: new Date(),
    });

    const MAX_VERSIONS = 20;

    if (project.versions.length > MAX_VERSIONS) {
      project.versions = project.versions.slice(-MAX_VERSIONS);
    }

    project.files = targetVersion.files.map((file) => ({
      path: file.path,
      content: file.content,
    }));

    project.status = "ready";

    await project.save();

    return NextResponse.json({
      success: true,
      message: `Version ${version} restored successfully.`,
      project: project.toObject(),
    });
  } catch (error) {
    console.error("POST /api/projects/[id]/history error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to restore project version.",
      },
      { status: 500 },
    );
  }
}
