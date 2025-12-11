import type { AuthConfig } from "convex/server";

// Convex reads this file on the server to know which auth providers
// can issue tokens. For Clerk, the domain must match the ISSUER of
// the Clerk JWT template you created (usually named "convex").
//
// In Clerk dashboard:
//  - Create a JWT template called "convex"
//  - Copy the "Issuer" URL and set it as CLERK_JWT_ISSUER_DOMAIN
//  - Ensure this env var is available to the Convex dev/prod process

export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;


