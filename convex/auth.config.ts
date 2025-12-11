import type { AuthConfig } from "convex/server";

const authConfig = {
  providers: [
    {
      // Issuer domain for your Clerk JWT template.
      // Commonly provided via an environment variable like CLERK_JWT_ISSUER_DOMAIN
      // or CLERK_FRONTEND_API_URL depending on your setup.
      domain: process.env.CLERK_FRONTEND_API_URL!,
      // This should match the name of your Clerk JWT template (usually "convex").
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;

export default authConfig;


