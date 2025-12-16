import { NextResponse } from "next/server";

const REPO_OWNER = "audgeviolin07";
const REPO_NAME = "asillios-limiter";

export async function GET() {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          // Add GitHub token if available for higher rate limits
          ...(process.env.GITHUB_TOKEN && {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          }),
        },
        next: { revalidate: 60 }, // Cache for 60 seconds
      }
    );

    if (!response.ok) {
      throw new Error(`GitHub API responded with ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      stars: data.stargazers_count,
      url: data.html_url,
    });
  } catch (error) {
    console.error("Error fetching GitHub stars:", error);
    return NextResponse.json(
      { stars: null, error: "Failed to fetch stars" },
      { status: 500 }
    );
  }
}
