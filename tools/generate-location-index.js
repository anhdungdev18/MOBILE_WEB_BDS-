// tools/generate-location-index.js
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, "assets", "locations", "districts");
const WARD_DIR = path.join(ROOT, "assets", "locations", "wards");
const OUT_DIR = path.join(ROOT, "src", "utils");

function ensureDir(p) {
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function listJsonCodes(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => path.basename(f, ".json"))
        .sort((a, b) => a.localeCompare(b));
}

function genIndexFile(name, codes, relRequireBase) {
    // relRequireBase tính từ file output (src/utils) tới assets/locations/...
    const lines = [];
    lines.push("// AUTO-GENERATED. Do not edit manually.");
    lines.push(`// Generated at: ${new Date().toISOString()}`);
    lines.push("");
    lines.push("export const INDEX = {");
    for (const code of codes) {
        lines.push(`  "${code}": require("${relRequireBase}/${code}.json"),`);
    }
    lines.push("};");
    lines.push("");
    lines.push("export default INDEX;");
    lines.push("");
    return lines.join("\n");
}

function main() {
    ensureDir(OUT_DIR);

    const districtCodes = listJsonCodes(DIST_DIR);
    const wardCodes = listJsonCodes(WARD_DIR);

    // từ src/utils -> assets/locations/...
    const relToDistricts = "../../assets/locations/districts";
    const relToWards = "../../assets/locations/wards";

    const distOut = path.join(OUT_DIR, "districtsIndex.js");
    const wardOut = path.join(OUT_DIR, "wardsIndex.js");

    fs.writeFileSync(
        distOut,
        genIndexFile("districtsIndex", districtCodes, relToDistricts),
        "utf8"
    );
    fs.writeFileSync(
        wardOut,
        genIndexFile("wardsIndex", wardCodes, relToWards),
        "utf8"
    );

    console.log("✅ Generated:");
    console.log(" -", path.relative(ROOT, distOut), `(${districtCodes.length} files)`);
    console.log(" -", path.relative(ROOT, wardOut), `(${wardCodes.length} files)`);
}

main();
