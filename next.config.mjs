/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Native / server-only modules used by the adjudication graph must not be bundled by webpack.
    serverComponentsExternalPackages: [
      "better-sqlite3",
      "@langchain/langgraph",
      "@langchain/langgraph-checkpoint-sqlite",
    ],
  },
};

export default nextConfig;
