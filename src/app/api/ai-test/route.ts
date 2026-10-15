
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { success: false, message: "OpenRouter API key is missing." },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openrouter/free",
          messages: [
            {
              role: "user",
              content: "Reply with exactly: Nexora AI connected",
            },
          ],
          max_tokens: 20,
        }),
        signal: AbortSignal.timeout(20000),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenRouter test failed:", data);

      return NextResponse.json(
        {
          success: false,
          message:
            data?.error?.message || "OpenRouter returned an error.",
          status: response.status,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: data.choices?.[0]?.message?.content ?? "Empty response",
      model: data.model,
    });
  } catch (error) {
    console.error("OpenRouter connection test failed:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.name === "TimeoutError"
              ? "OpenRouter did not respond within 20 seconds."
              : error.message
            : "Could not connect to OpenRouter.",
      },
      { status: 502 }
    );
  }
}