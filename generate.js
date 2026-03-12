/**
 * generate.js — Blog Generator
 *
 * Generates a blog post using the Google Gemini API and Pexels API,
 * then publishes it to Blogger via the publish-by-email feature.
 *
 * Can be used in two ways:
 *   1. Standalone:  node generate.js          (runs once)
 *   2. As module:   require('./generate')()   (called by index.js cron)
 */

const https = require("https");
const http = require("http");
const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");

// ---------------------------------------------------------------------------
// Load .env file (simple parser — no extra dependency needed)
// ---------------------------------------------------------------------------

function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnv();

// ---------------------------------------------------------------------------
// Configuration (read from environment variables)
// ---------------------------------------------------------------------------

function getConfig() {
  return {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    PEXELS_API_KEY: process.env.PEXELS_API_KEY || "",
    BLOGGER_EMAIL: process.env.BLOGGER_EMAIL,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: parseInt(process.env.SMTP_PORT || "465", 10),
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    BLOG_CATEGORIES: process.env.BLOG_CATEGORIES || "technology,lifestyle,health",
    BLOG_WORDS: parseInt(process.env.BLOG_WORDS || "1200", 10),
    BLOG_PROMPT: process.env.BLOG_PROMPT || "",
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Make an HTTPS/HTTP request and return the response.
 */
function httpsRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith("https") ? https : http;
    const req = proto.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

/**
 * Extract and parse a JSON object from a raw string.
 * Mirrors the PHP cleanAndDecodeJson() function.
 */
function cleanAndDecodeJson(raw) {
  const firstBracket = raw.indexOf("{");
  const lastBracket = raw.lastIndexOf("}");
  if (firstBracket === -1 || lastBracket === -1) return null;

  let jsonString = raw.substring(firstBracket, lastBracket + 1);

  // Remove UTF-8 BOM if present
  if (jsonString.charCodeAt(0) === 0xfeff) {
    jsonString = jsonString.slice(1);
  }

  try {
    return JSON.parse(jsonString);
  } catch {
    console.error("[ERROR] JSON parse failed from raw API response");
    return null;
  }
}

// ---------------------------------------------------------------------------
// Gemini API
// ---------------------------------------------------------------------------

/**
 * Call the Google Gemini API with a prompt.
 * Uses the same model and generation config as the PHP version.
 */
async function callGeminiAPI(prompt, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const payload = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      topP: 0.8,
      topK: 10,
    },
  });

  const res = await httpsRequest(
    url,
    { method: "POST", headers: { "Content-Type": "application/json" } },
    payload
  );

  if (res.status !== 200) {
    return {
      success: false,
      data: null,
      error: `API HTTP ${res.status}: ${res.body}`,
    };
  }

  const responseData = JSON.parse(res.body);
  const text = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    return { success: false, data: null, error: "Unexpected API response format." };
  }

  const json = cleanAndDecodeJson(text);
  if (!json) {
    return { success: false, data: null, error: "Failed to parse JSON from API response." };
  }

  return { success: true, data: json, error: null };
}

// ---------------------------------------------------------------------------
// Blog Generation — prompts identical to controllers/Blog.php
// ---------------------------------------------------------------------------

/**
 * Generate 3 blog post outlines / titles.
 * Same prompt as PHP generate_titles().
 */
async function generateTitles(config) {
  const categoryList = config.BLOG_CATEGORIES.split(",")
    .map((c) => c.trim())
    .join(", ");

  const prompt = `
Generate outline for 3 topics, catchy, and SEO-friendly blog post for the any three of following categories: ${categoryList}.
Ensure the outlines are unique (human tone) and authentic. Each description should be only of 200 words or less.

Example of outline as a string:
'
    Title: [Your Blog Title]I
    Introduction
    Brief context or hook.
    Why the topic matters.
    Main Point 1
    Key idea or argument.
    One supporting detail or example.
    Main Point 2
    Key idea or argument.
    One supporting detail or example.
    Main Point 3 (optional)
    Key idea or argument.
    One supporting detail or example.
    Conclusion
    Quick recap.
    Call-to-action or final thought.
    Persona : Define the tone / person who is writing this.
'


Format the output as a valid JSON object following this exact schema:
{
    "descriptions": ["string", "string", "string"]
}
`;

  const response = await callGeminiAPI(prompt, config.GEMINI_API_KEY);
  if (!response.success) {
    console.error("[ERROR] Title generation failed:", response.error);
    return null;
  }

  if (response.data?.descriptions && Array.isArray(response.data.descriptions)) {
    return response.data.descriptions;
  }

  return null;
}

/**
 * Generate full blog content from an outline.
 * Same prompt as PHP generate_content().
 */
async function generateContent(outline, config) {
  const categoriesString = config.BLOG_CATEGORIES;

  const prompt = `
Generate a blog post with the outline: ${outline}

User's Core Prompt: ${config.BLOG_PROMPT}

Improve the title to be catchy, emotionally resonant, and SEO-friendly, but don't include the title in the main content body itself.
Add exactly 6 relevant keywords (formatted as slugs).
Write the content in about ${config.BLOG_WORDS} words using markdown format.

Adopt the following humanizing writing style:

1.  Persona: Write as if you're talking to a friend over coffee—informal, warm, and genuine. Use contractions and address the reader directly.
2.  Vocabulary: Avoid overly formal or academic language. Replace complex words with simpler, everyday alternatives. (e.g., instead of 'utilize,' say 'use'; instead of 'aspirations,' say 'dreams' or 'desires').
3.  Rhythm: Vary your sentence length. Mix shorter, punchier sentences with slightly longer ones. Read it aloud to ensure it has a natural, spoken rhythm.
4.  Tone: Be conversational and relatable. It's okay to use gentle colloquialisms (like 'a heck of a lot' or 'let's get real') to make the text feel grounded and less like a perfect, sterile AI output.

Use sub-headings (##) to structure the content.
The content must be SEO Friendly.
Provide a short, 2-word keyword phrase for a thumbnail image search.
Provide a meta description of around 20-30 words that evokes curiosity or emotion.
Choose up to 3 valid categories for this article from the following list: ${categoriesString}.
If the 'User's Core Prompt' provides image links, insert them into the content.

The final output must be in a valid JSON format that matches this exact schema.
Do not include any markdown formatting, code block fences, or any explanatory text outside of the JSON object itself.
IMPORTANT: Ensure that any double-quote (") characters used inside the title, content, or description strings are properly escaped with a backslash (\\").

{
    "title": "string",
    "keywords": ["string"],
    "content": "string",
    "description": "string",
    "categories": ["string"],
    "thumbnail": "string"
}
`;

  return callGeminiAPI(prompt, config.GEMINI_API_KEY);
}

// ---------------------------------------------------------------------------
// Pexels API — mirrors PHP search_thumbnail()
// ---------------------------------------------------------------------------

/**
 * Search for a landscape thumbnail image on Pexels.
 */
async function searchThumbnail(query, apiKey) {
  if (!query || !apiKey) return "";

  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;

  try {
    const res = await httpsRequest(url, {
      method: "GET",
      headers: { Authorization: apiKey },
    });

    if (res.status === 200) {
      const data = JSON.parse(res.body);
      return data?.photos?.[0]?.src?.landscape || "";
    }
  } catch (err) {
    console.error("[ERROR] Pexels API:", err.message);
  }

  return "";
}

// ---------------------------------------------------------------------------
// Markdown → HTML converter
// ---------------------------------------------------------------------------

/**
 * Convert markdown content to basic HTML.
 * Matches the PHP Parsedown behavior (headings, bold, italic, links, images, lists).
 */
function markdownToHtml(md) {
  const lines = md.split("\n");
  // Remove the first 2 lines (title + blank line) — same as PHP version
  const content = lines.slice(2).join("\n");

  let html = content
    // Headings
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Bold + Italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Unordered lists
    .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
    // Horizontal rules
    .replace(/^---$/gm, "<hr/>");

  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");

  // Wrap remaining plain text blocks in <p>
  const paragraphs = html.split(/\n{2,}/);
  html = paragraphs
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (/^<(?:h[1-6]|ul|ol|li|hr|img|blockquote|div|table|pre)/.test(trimmed)) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("\n");

  return html;
}

// ---------------------------------------------------------------------------
// Send email to Blogger
// ---------------------------------------------------------------------------

/**
 * Send the generated blog post to Blogger via publish-by-email.
 * Blogger uses the email subject as the post title and the HTML body as the content.
 */
async function sendToBlogger(title, htmlContent, thumbnailUrl, config) {
  const transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS,
    },
  });

  let body = "";
  if (thumbnailUrl) {
    body += `<img src="${thumbnailUrl}" alt="${title}" style="max-width:100%;height:auto;margin-bottom:16px;" />\n`;
  }
  body += htmlContent;

  const info = await transporter.sendMail({
    from: config.SMTP_USER,
    to: config.BLOGGER_EMAIL,
    subject: title,
    html: body,
  });

  return info;
}

// ---------------------------------------------------------------------------
// Main — generate one blog post and publish
// ---------------------------------------------------------------------------

async function generate() {
  const config = getConfig();

  console.log("=== Blog Generator Started ===");
  console.log(`Date : ${new Date().toISOString()}`);

  // Validate required env vars
  if (!config.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set. Check your .env file.");
  }
  if (!config.BLOGGER_EMAIL || !config.SMTP_HOST || !config.SMTP_USER || !config.SMTP_PASS) {
    throw new Error("BLOGGER_EMAIL, SMTP_HOST, SMTP_USER, and SMTP_PASS are required. Check your .env file.");
  }

  // Step 1: Generate outlines
  console.log("\n[1/4] Generating blog post outlines...");
  const titles = await generateTitles(config);
  if (!titles || titles.length === 0) {
    throw new Error("Failed to generate blog post outlines from AI.");
  }
  console.log(`  → ${titles.length} outlines generated.`);

  // Step 2: Pick one and generate full content
  const chosenOutline = titles[Math.floor(Math.random() * titles.length)];
  console.log("\n[2/4] Generating full article content...");
  const contentResponse = await generateContent(chosenOutline, config);
  if (!contentResponse.success) {
    throw new Error("Failed to generate content: " + contentResponse.error);
  }

  const article = contentResponse.data;
  console.log(`  → Title     : ${article.title}`);
  console.log(`  → Keywords  : ${article.keywords?.join(", ")}`);
  console.log(`  → Categories: ${article.categories?.join(", ")}`);

  // Step 3: Get thumbnail from Pexels
  console.log("\n[3/4] Searching thumbnail image...");
  const thumbnailUrl = await searchThumbnail(article.thumbnail, config.PEXELS_API_KEY);
  if (thumbnailUrl) {
    console.log(`  → Thumbnail : ${thumbnailUrl}`);
  } else {
    console.log("  → No thumbnail found, continuing without image.");
  }

  // Step 4: Convert to HTML and send email
  const htmlContent = markdownToHtml(article.content || "");

  console.log("\n[4/4] Sending to Blogger via email...");
  const info = await sendToBlogger(article.title, htmlContent, thumbnailUrl, config);
  console.log(`  → Email sent: ${info.messageId}`);

  console.log("\n=== Blog post published successfully! ===");
  console.log(`Title: "${article.title}"\n`);

  return article;
}

// ---------------------------------------------------------------------------
// Export for use by index.js (cron) + allow standalone execution
// ---------------------------------------------------------------------------

module.exports = generate;

// Run directly: node generate.js
if (require.main === module) {
  generate().catch((err) => {
    console.error("\n[FATAL]", err.message || err);
    process.exit(1);
  });
}
