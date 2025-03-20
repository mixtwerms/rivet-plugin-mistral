import * as esbuild from "esbuild";
import { join, dirname } from "node:path";
import copy from "recursive-copy";
import { platform, homedir } from "node:os";
import { readFile, rm, mkdir, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getAppDataLocalPath() {
  const identifier = "com.ironcladapp.rivet";
  if (platform() === "darwin") {
    return join(homedir(), "Library", "Application Support", identifier);
  } else if (platform() === "win32") {
    return join(homedir(), "AppData", "Local", identifier);
  } else {
    return join(homedir(), ".local", "share", identifier);
  }
}

const syncPlugin: esbuild.Plugin = {
  name: "onBuild",
  setup(build) {
    build.onEnd(async () => {
      const packageJson = JSON.parse(
        await readFile(join(__dirname, "package.json"), "utf-8")
      );
      const pluginName = packageJson.name;

      const rivetPluginsDirectory = join(getAppDataLocalPath(), "plugins");
      const thisPluginDirectory = join(
        rivetPluginsDirectory,
        `${pluginName}-latest`
      );

      await rm(join(thisPluginDirectory, "package"), {
        recursive: true,
        force: true,
      });
      await mkdir(join(thisPluginDirectory, "package"), { recursive: true });

      await copy(
        join(__dirname, "dist"),
        join(thisPluginDirectory, "package", "dist")
      );
      await copyFile(
        join(__dirname, "package.json"),
        join(thisPluginDirectory, "package", "package.json")
      );

      // Copy .git to mark as locally installed plugin
      try {
        await copy(
          join(__dirname, ".git"),
          join(thisPluginDirectory, "package", ".git")
        );
      } catch (err) {
        console.warn("Warning: Could not copy .git directory", err);
      }

      console.log(
        `Synced ${pluginName} to Rivet at ${thisPluginDirectory}. Refresh or restart Rivet to see changes.`
      );
    });
  },
};

const rewriteNodeEntryPlugin: esbuild.Plugin = {
  name: "rewrite-node-entry",
  setup(build) {
    build.onResolve({ filter: /\/nodeEntry$/ }, (args) => {
      return {
        external: true,
        path: "../dist/nodeEntry.cjs",
      };
    });
  },
};

const isomorphicBundleOptions: esbuild.BuildOptions = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "neutral",
  target: "es2020",
  outfile: "dist/bundle.js",
  format: "esm",
  external: [
    "@ironclad/rivet-core"  // Only keep rivet-core as external
  ],
  plugins: [rewriteNodeEntryPlugin],
};

const nodeBundleOptions = {
  entryPoints: ["src/nodeEntry.ts"],
  bundle: true,
  platform: "node",
  target: "es2020",
  outfile: "dist/nodeEntry.cjs",
  format: "cjs",
  external: ["@ironclad/rivet-core"], // Only keep rivet-core as external
  plugins: [] as esbuild.Plugin[],
} satisfies esbuild.BuildOptions;


if (process.argv.includes("--sync")) {
  nodeBundleOptions.plugins.push(syncPlugin);
}

if (process.argv.includes("--watch")) {
  const isoContext = await esbuild.context(isomorphicBundleOptions);
  await isoContext.watch();

  const nodeContext = await esbuild.context(nodeBundleOptions);
  await nodeContext.watch();

  console.log("Watching for changes...");
} else {
  await esbuild.build(isomorphicBundleOptions);
  await esbuild.build(nodeBundleOptions);
}
