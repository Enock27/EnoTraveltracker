import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const app = express();
const port = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "world",
  password: "karuta#@ABC123",
  port: 5432,
});
db.connect();

// Build country name to code mapping from SVG in index.ejs
const ejsPath = path.join(__dirname, "views", "index.ejs");
let countryNameToCode = {};
try {
  const ejsContent = fs.readFileSync(ejsPath, "utf8");
  // Regex to match <path id="XX" title="Country Name"
  const regex = /<path id="([A-Z]{2})" title="([^"]+)"/g;
  let match;
  while ((match = regex.exec(ejsContent)) !== null) {
    const code = match[1].toUpperCase();
    const name = match[2].toLowerCase();
    countryNameToCode[name] = code;
  }
} catch (err) {
  console.error("Failed to build country name mapping:", err);
}

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", "views");

app.get("/", async (req, res) => {
  try {
    const result = await db.query("SELECT country_code FROM visited_countries");
    const countries = result.rows.map((row) => row.country_code);
    res.render("index", {
      countries: countries.join(","),
      total: countries.length,
      error: null,
    });
  } catch (err) {
    res.render("index", { countries: "", total: 0, error: "DB Error" });
  }
});

app.post("/add", async (req, res) => {
  let country = req.body.country?.trim();
  if (!country) {
    const result = await db.query("SELECT country_code FROM visited_countries");
    const countries = result.rows.map((row) => row.country_code);
    return res.render("index", {
      countries: countries.join(","),
      total: countries.length,
      error: "Please enter a country name or code.",
    });
  }
  let code = null;
  if (/^[A-Z]{2}$/i.test(country)) {
    code = country.toUpperCase();
  } else {
    const lookup = country.toLowerCase();
    code = countryNameToCode[lookup];
  }
  if (!code) {
    const result = await db.query("SELECT country_code FROM visited_countries");
    const countries = result.rows.map((row) => row.country_code);
    return res.render("index", {
      countries: countries.join(","),
      total: countries.length,
      error: "Invalid country name or code.",
    });
  }
  try {
    // Prevent duplicates
    await db.query(
      "INSERT INTO visited_countries (country_code) VALUES ($1) ON CONFLICT (country_code) DO NOTHING",
      [code]
    );
    res.redirect("/");
  } catch (err) {
    const result = await db.query("SELECT country_code FROM visited_countries");
    const countries = result.rows.map((row) => row.country_code);
    res.render("index", {
      countries: countries.join(","),
      total: countries.length,
      error: "DB Error",
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
