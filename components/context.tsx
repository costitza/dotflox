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
    <ClerkProvider>
      <ConvexClientProvider>{children}</ConvexClientProvider>
    </ClerkProvider>
  );
}


