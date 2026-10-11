import { ScreepsHttpClient } from "screeps-api";
import { readFile } from "node:fs/promises";

if (!process.env.SCREEPS_TOKEN) throw new Error("No SCREEPS_TOKEN found in env");

const api = new ScreepsHttpClient({ token: process.env.SCREEPS_TOKEN });
const code = await readFile("dist/main.js", "utf8");

await api.userCodeSet({
  branch: process.env.SCREEPS_BRANCH || "default",
  modules: { main: code },
});

console.log("✅ Upload complete!");