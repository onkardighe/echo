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

    // Load environment variables
    const loadEnv = (path) => {
        if (fs.existsSync(path)) {
            const content = fs.readFileSync(path, 'utf-8');
            return content.split('\n').reduce((acc, line) => {
                const [key, val] = line.split('=');
                if (key && val) acc[key.trim()] = val.trim();
                return acc;
            }, {});
        }
        return {};
    };

    const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
    const envConfig = { ...loadEnv('.env'), ...loadEnv(envFile) };

    // Default fallback
    if (!envConfig.API_BASE_URL) envConfig.API_BASE_URL = 'http://localhost:3000';

    const define = {
        'process.env.API_BASE_URL': JSON.stringify(envConfig.API_BASE_URL),
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
    };

    console.log(`Building with API_BASE_URL: ${envConfig.API_BASE_URL}`);

    // Build TypeScript
    const ctx = await esbuild.context({
        define,
        entryPoints: [
            "src/background.ts",
            "src/sidepanel.ts",
            "src/permissions.ts"
        ],
        bundle: true,
        outdir: "dist",
        target: "chrome115",
        sourcemap: process.env.NODE_ENV !== 'production', // Disable sourcemap in prod
        minify: process.env.NODE_ENV === 'production',
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
    copyFile("src/manifest.json", "dist/manifest.json");

    // Copy HTML/CSS
    copyFile("src/sidepanel.html", "dist/sidepanel.html");
    copyFile("src/sidepanel.css", "dist/sidepanel.css");
    copyFile("src/permissions.html", "dist/permissions.html");
    // Copy Icons
    ensureDir("dist/icons");
    if (fs.existsSync("icons")) {
        copyFile("icons/icon16.png", "dist/icons/icon16.png");
        copyFile("icons/icon48.png", "dist/icons/icon48.png");
        copyFile("icons/icon128.png", "dist/icons/icon128.png");
    }
};

build().catch(() => process.exit(1));
