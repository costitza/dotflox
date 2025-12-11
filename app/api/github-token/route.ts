import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const tokens = await (await clerkClient()).users.getUserOauthAccessToken(
      userId,
      "github"
    );

    const token = tokens.data[0]?.token;

    if (!token) {
      return new NextResponse("No GitHub OAuth token for GitHub", {
        status: 404,
      });
    }

    return NextResponse.json({ token });
  } catch (error) {
    console.error("Error fetching GitHub OAuth token from Clerk", error);
    return new NextResponse("Failed to fetch GitHub OAuth token", {
      status: 500,
    });
  }
}

