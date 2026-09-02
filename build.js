const fs = require("fs");
const path = require("path");

function loadDotenv() {
  const dotenvPath = path.join(__dirname, ".env");
  if (!fs.existsSync(dotenvPath)) return {};
  const lines = fs.readFileSync(dotenvPath, "utf8").split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const k = trimmed.slice(0, idx).trim();
    let v = trimmed.slice(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
  return env;
}

const dotenv = loadDotenv();
const url = process.env.SUPABASE_URL || dotenv.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY || dotenv.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Erro: defina as variáveis de ambiente SUPABASE_URL e SUPABASE_ANON_KEY ou crie um arquivo .env com elas.");
  process.exit(1);
}

const template = path.join(__dirname, "js", "supabase.template.js");
const output = path.join(__dirname, "js", "supabase.js");
let content = fs.readFileSync(template, "utf8");
content = content.replace(/\$SUPABASE_URL/g, url);
content = content.replace(/\$SUPABASE_ANON_KEY/g, key);
fs.writeFileSync(output, content);

console.log("js/supabase.js gerado com sucesso.");
