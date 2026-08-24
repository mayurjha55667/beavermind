import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
  outputFileTracingIncludes: {
    "/*": ["./src/lib/rubrics/source/*.md"],
  },
};

export default withWorkflow(nextConfig);
