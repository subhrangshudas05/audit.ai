import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
    let browser: any = null;
    const base64Frames: any[] = [];
    const base64Strings: string[] = []; // NEW: To send back to frontend

    try {
        const body = await req.json();
        const { url, delay = 1000, device = "desktop" } = body;

        // --- VALIDATION ---
        if (!url || typeof url !== "string") {
            return NextResponse.json({ error: "Valid URL required" }, { status: 400 });
        }

        try {
            const parsed = new URL(url);
            if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
        } catch {
            return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
        }

        // --- BROWSER ---
        browser = await puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"]
        });

        const page = await browser.newPage();

        // --- DEVICE VIEWPORT (OPTIMIZED) ---
        if (device === "mobile") {
            await page.setUserAgent(
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
            );

            await page.setViewport({
                width: 393,
                height: 852,
                isMobile: true,
                hasTouch: true,
                deviceScaleFactor: 1 // 🔥 IMPORTANT: prevents token explosion
            });

        } else {
            await page.setUserAgent(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            );

            await page.setViewport({
                width: 1440,
                height: 900,
                deviceScaleFactor: 1 // 🔥 IMPORTANT
            });
        }

        // Abort signal
        const abortPromise = new Promise((_, reject) => {
            req.signal.addEventListener("abort", () => reject(new Error("ABORT_SIGNAL")));
        });

        // --- NAVIGATION ---
        try {
            await Promise.race([
                page.goto(url, { waitUntil: "networkidle0", timeout: 60000 }),
                abortPromise
            ]);
        } catch (error: any) {
            if (browser) await browser.close();
            if (error.message === "ABORT_SIGNAL" || req.signal.aborted) {
                return new Response("Scan Aborted", { status: 499 });
            }
            throw error;
        }

        // --- AUDIT FOLDER ---
        // const AUDIT_DIR = path.join(process.cwd(), "public", "audit");
        // if (!fs.existsSync(AUDIT_DIR)) fs.mkdirSync(AUDIT_DIR, { recursive: true });

        // const sessionName = `scan-${Date.now()}`;
        // const sessionPath = path.join(AUDIT_DIR, sessionName);
        // if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

        // --- SCROLL & CAPTURE ---
        let index = 1;
        let isAtBottom = false;

        while (!isAtBottom && index <= 10) {
            if (req.signal.aborted) throw new Error("ABORT_SIGNAL");

            const imageBuffer = await Promise.race([
                page.screenshot({
                    type: "jpeg",
                    quality: 40, // 🔥 optimized payload size
                    fullPage: false
                }),
                abortPromise
            ]) as Buffer;

            const b64 = imageBuffer.toString("base64");

            // 1. SAVE FOR FRONTEND (Full Data URL)
            base64Strings.push(`data:image/jpeg;base64,${b64}`);

            // 2. SAVE FOR GEMINI
            base64Frames.push({
                inlineData: { data: b64, mimeType: "image/jpeg" },
            });

            const scrollStatus = await page.evaluate(() => {
                const current = window.pageYOffset + window.innerHeight;
                const total = document.documentElement.scrollHeight;
                return { isBottom: current >= total - 50 };
            });

            if (scrollStatus.isBottom) {
                isAtBottom = true;
            } else {
                const scrollAmount = device === "mobile" ? 750 : 800;
                await page.mouse.wheel({ deltaY: scrollAmount });
                await new Promise(r => setTimeout(r, delay));
                index++;
            }
        }

        await browser.close();

        if (base64Frames.length === 0) {
            throw new Error("No screenshots captured");
        }

        // --- GEMINI ---
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ]
        });

        const deviceContext = device === 'mobile'
            ? "MOBILE VIEWPORT (iPhone 15 Pro context). Focus on: Thumb-friendly touch targets (min 44px), readable font sizes (min 16px), hamburger menu accessibility, and stacked layout logic."
            : "DESKTOP VIEWPORT (1440p context). Focus on: Efficient use of horizontal space, hover states, F-pattern scanning, and navigation information architecture.";

        const prompt = `
You are a Senior UX Architect and CRO Specialist. 
Analyze these ${base64Frames.length} screenshots as a continuous user journey on a **${deviceContext}**. 

For each screenshot, provide a structured audit following these SPECIFIC quality standards:

1. **Analysis (The Diagnosis)**: 
   - Identify friction specific to ${device} usage.
   - Reference specific UI patterns (e.g., ${device === 'mobile' ? '"Touch target too small",' : '"White space misuse",'} "Contrast ratio").

2. **Fix (The Blueprint)**: 
   - Must be technical (CSS/Design terminology).
   - Example: ${device === 'mobile' ? '"Increase padding to 1.5rem for touch,"' : '"Use a max-width container of 1200px,"'}.

3. **Impact (The ROI)**: 
   - Connect the fix to a specific business metric (Conversion Rate, Bounce Rate, etc.).

4. **Score**:
   - 0-100. Be strict.

STRICT JSON OUTPUT FORMAT (Array of Objects):
[
  {
    "imageIndex": number (0 to ${base64Frames.length - 1}),
    "section": "Hero" | "Features" | "Testimonials" | "Footer" | "General",
    "score": number,
    "level": "Critical" | "Needs Improvement" | "Optimal",
    "analysis": ["Point 1", "Point 2"],
    "fix": ["Fix 1", "Fix 2"],
    "impact": "Business Value statement"
  }
]
Return ONLY raw JSON. No markdown formatting.
`;

        const result = await model.generateContent([prompt, ...base64Frames]);
        const response = await result.response;
        let text = response.text();

        text = text.replace(/```json/g, "").replace(/```/g, "").trim();

        let auditData;
        try {
            auditData = JSON.parse(text);
        } catch {
            console.error("JSON Parse Error:", text);
            auditData = [{
                imageIndex: 0,
                section: "General",
                score: 0,
                level: "Critical",
                analysis: ["AI response parsing failed."],
                fix: ["Retry scan."],
                impact: "System failure."
            }];
        }

        return NextResponse.json({
            success: true,
            audit: auditData,
            screenshots: base64Strings,
            device,
        });

    } catch (error: any) {
        if (browser) await browser.close();

        if (error.message === "ABORT_SIGNAL") {
            return new Response("Scan Aborted", { status: 499 });
        }

        console.error("Server Error:", error);
        return NextResponse.json(
            { error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
