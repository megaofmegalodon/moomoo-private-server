import * as esbuild from "esbuild";

async function main() {
    const ctx = await esbuild.context({
        bundle: true,
        entryPoints: ["src/index.ts"],
        outfile: "dist/server.js",
        minify: true,
        minifySyntax: true,
        platform: "node"
    });

    ctx.watch();
    console.log("Watching and bundling files...");
}

main();