const fs = require("fs");
const path = require("path");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Erro: defina as variáveis de ambiente SUPABASE_URL e SUPABASE_ANON_KEY.");
  process.exit(1);
}

const template = path.join(__dirname, "js", "supabase.template.js");
const output = path.join(__dirname, "js", "supabase.js");
let content = fs.readFileSync(template, "utf8");
content = content.replace(/\$SUPABASE_URL/g, url);
content = content.replace(/\$SUPABASE_ANON_KEY/g, key);
fs.writeFileSync(output, content);

console.log("js/supabase.js gerado com sucesso.");
