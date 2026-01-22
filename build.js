const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const ensureDir = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

const copyFile = (src, dest) => {
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
    }
};

const build = async () => {
    const watch = process.argv.includes("--watch");

    ensureDir("dist");
    ensureDir("dist/icons");

    // Build TypeScript
    const ctx = await esbuild.context({
        entryPoints: [
            "src/background.ts",
            "src/sidepanel.ts"
        ],
        bundle: true,
        outdir: "dist",
        target: "chrome115",
        sourcemap: true,
        minify: false,
        format: "esm",
    });

    if (watch) {
        await ctx.watch();
        console.log("Watching for changes...");
    } else {
        await ctx.rebuild();
        await ctx.dispose();
        console.log("Build complete.");
    }

    // Copy HTML/CSS
    copyFile("src/sidepanel.html", "dist/sidepanel.html");
    copyFile("src/sidepanel.css", "dist/sidepanel.css");
    // Copy Icons (Placeholder)
    // fs.cpSync("icons", "dist/icons", { recursive: true });
};

build().catch(() => process.exit(1));
