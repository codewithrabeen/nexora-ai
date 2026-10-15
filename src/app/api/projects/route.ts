
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Project from "@/models/Project";

export const runtime = "nodejs";

export async function GET() {
  try {
    await connectToDatabase();

    const projects = await Project.find()
      .sort({ updatedAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      projects,
    });
  } catch (error) {
    console.error("Fetch projects failed:", error);

    return NextResponse.json(
      { success: false, message: "Failed to fetch projects." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("prompt" in body) ||
      typeof body.prompt !== "string"
    ) {
      return NextResponse.json(
        { success: false, message: "A valid prompt is required." },
        { status: 400 }
      );
    }

    const prompt = body.prompt.trim();

    if (!prompt || prompt.length > 10000) {
      return NextResponse.json(
        {
          success: false,
          message: "Prompt must contain 1–10,000 characters.",
        },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const project = await Project.create({
      name: prompt.slice(0, 60),
      description: "AI website project",
      prompt,
      status: "draft",
    });

    return NextResponse.json(
      { success: true, project },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create project failed:", error);

    return NextResponse.json(
      { success: false, message: "Failed to create project." },
      { status: 500 }
    );
  }
}