"use client";

import { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import ConvexClientProvider from "@/app/ConvexClientProvider";

export default function ContextProviders({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
      <ConvexClientProvider>{children}</ConvexClientProvider>
    </ClerkProvider>
  );
}


