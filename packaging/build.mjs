import * as esbuild from "esbuild";

async function main() {
    await esbuild.build({
        bundle: true,
        entryPoints: ["src/index.ts"],
        outfile: "dist/server.js",
        minify: true,
        minifySyntax: true,
        platform: "node"
    });

    console.log("Finished building files.");
}

main();