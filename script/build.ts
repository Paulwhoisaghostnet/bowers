import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";

const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function getExternals() {
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  return allDeps.filter((dep) => !allowlist.includes(dep));
}

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const externals = await getExternals();

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });
}

async function buildNetlify() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building netlify function...");
  await esbuild({
    entryPoints: ["netlify/functions/api.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/functions/api.js",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: ["pg-native"],
    logLevel: "info",
  });
}

const mode = process.argv[2];

if (mode === "--netlify") {
  buildNetlify().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  buildAll().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
