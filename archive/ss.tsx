import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
    let browser: any = null;
    const base64Frames: any[] = [];
    let sessionName = ''; // Define sessionName in outer scope

    try {
        const body = await req.json();
        const { url, delay = 1000, device = 'desktop' } = body; // <--- 1. Get Device Type

        // --- 1. VALIDATION ---
        if (!url || typeof url !== 'string') {
            return NextResponse.json({ error: 'Valid URL required' }, { status: 400 });
        }
        try {
            const parsed = new URL(url);
            if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
        } catch {
            return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
        }

        // --- 2. BROWSER SETUP & DEVICE CONFIG ---
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
        });

        const page = await browser.newPage();

        // --- 3. DYNAMIC VIEWPORT CONFIGURATION ---
        if (device === 'mobile') {
            // Emulate iPhone 15 Pro Max / High-end Android
            await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
            await page.setViewport({
                width: 393,
                height: 852,
                isMobile: true,
                hasTouch: true,
                deviceScaleFactor: 3
            });
        } else {
            // Standard Desktop
            await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
            await page.setViewport({
                width: 1440,
                height: 900,
                deviceScaleFactor: 2 // Crisp screenshots
            });
        }

        // Abort Controller Setup
        const abortPromise = new Promise((_, reject) => {
            req.signal.addEventListener('abort', () => reject(new Error('ABORT_SIGNAL')));
        });

        // --- 4. NAVIGATE ---
        try {
            await Promise.race([
                page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 }),
                abortPromise
            ]);
        } catch (error: any) {
            if (browser) await browser.close();
            if (error.message === 'ABORT_SIGNAL' || req.signal.aborted) {
                return new Response('Scan Aborted', { status: 499 });
            }
            throw error;
        }

        const AUDIT_DIR = path.join(process.cwd(), 'public', 'audit');
        if (!fs.existsSync(AUDIT_DIR)) fs.mkdirSync(AUDIT_DIR, { recursive: true });

        // Set sessionName here so it's accessible in the catch block if needed, 
        // though typically we only need it on success.
        sessionName = `scan-${Date.now()}`;
        const sessionPath = path.join(AUDIT_DIR, sessionName);
        if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

        let index = 1;
        let isAtBottom = false;

        // --- 5. SCROLL & CAPTURE ---
        while (!isAtBottom && index <= 8) { // Reduced to 8 for mobile/desktop parity speed
            if (req.signal.aborted) throw new Error('ABORT_SIGNAL');

            const imageBuffer = await Promise.race([
                page.screenshot({ type: 'jpeg', quality: 60, fullPage: false }),
                abortPromise
            ]) as Buffer;

            const fileName = `viewport-${index}.jpg`;
            fs.writeFileSync(path.join(sessionPath, fileName), imageBuffer);

            base64Frames.push({
                inlineData: {
                    data: imageBuffer.toString("base64"),
                    mimeType: "image/jpeg",
                },
            });

            const scrollStatus = await page.evaluate(() => {
                const current = window.pageYOffset + window.innerHeight;
                const total = document.documentElement.scrollHeight;
                return { isBottom: current >= total - 50 };
            });

            if (scrollStatus.isBottom) {
                isAtBottom = true;
            } else {
                // Mobile typically scrolls less pixels per swipe than a mouse wheel
                const scrollAmount = device === 'mobile' ? 750 : 800;
                await page.mouse.wheel({ deltaY: scrollAmount });
                await new Promise(r => setTimeout(r, delay));
                index++;
            }
        }

        await browser.close();

        // --- 6. GEMINI ANALYSIS ---
        if (base64Frames.length === 0) throw new Error("No screenshots captured");

        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash", // Updated to latest efficient model
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ]
        });

        // --- 7. DYNAMIC PROMPT CONTEXT ---
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

        const promptParts = [
            prompt,
            ...base64Frames.map(f => ({
                inlineData: {
                    data: f.inlineData.data,
                    mimeType: f.inlineData.mimeType
                }
            }))
        ];

        const result = await model.generateContent(promptParts);
        const response = await result.response;
        let text = response.text();

        text = text.replace(/```json/g, "").replace(/```/g, "").trim();
        let auditData;

        try {
            auditData = JSON.parse(text);
        } catch (jsonError) {
            console.error("JSON Parse Error:", text);
            // Fallback
            auditData = [{
                imageIndex: 0,
                section: "General",
                score: 0,
                level: "Critical",
                analysis: ["AI response parsing failed."],
                fix: ["Please try scanning again."],
                impact: "System error."
            }];
        }

        return NextResponse.json({
            success: true,
            folder: sessionName,
            device: device,
            audit: auditData
        });

    } catch (error: any) {
        if (browser) await browser.close();
        if (error.message === 'ABORT_SIGNAL') return new Response('Scan Aborted', { status: 499 });
        console.error("Server Error:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}






///import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
    let browser: any = null;
    let base64Frames: any[] = [];

    try {
        const body = await req.json();
        const { url, delay = 1000 } = body;

        // --- 1. VALIDATION ---
        if (!url || typeof url !== 'string') {
            return NextResponse.json({ error: 'Valid URL required' }, { status: 400 });
        }

        try {
            const parsed = new URL(url);
            if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
        } catch {
            return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
        }

        // --- 2. BROWSER SETUP ---
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
        });

        const page = await browser.newPage();

        await page.setUserAgent(
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        );

        await page.setViewport({ width: 1440, height: 900 });

        const abortPromise = new Promise((_, reject) => {
            req.signal.addEventListener('abort', () => reject(new Error('ABORT_SIGNAL')));
        });

        // --- 3. NAVIGATE ---
        try {
            await Promise.race([
                page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 }),
                abortPromise
            ]);
        } catch (error: any) {
            if (browser) await browser.close();
            if (error.message === 'ABORT_SIGNAL' || req.signal.aborted) {
                return new Response('Scan Aborted', { status: 499 });
            }
            throw error;
        }

        // --- 4. AUDIT FOLDER SETUP (FIX 2) ---
        const AUDIT_DIR = path.join(process.cwd(), 'public', 'audit');

        if (!fs.existsSync(AUDIT_DIR)) {
            fs.mkdirSync(AUDIT_DIR, { recursive: true });
        }

        const sessionName = `scan-${Date.now()}`;
        const sessionPath = path.join(AUDIT_DIR, sessionName);

        if (!fs.existsSync(sessionPath)) {
            fs.mkdirSync(sessionPath, { recursive: true });
        }

        // --- 5. SCAN LOOP ---
        let index = 1;
        let isAtBottom = false;

        while (!isAtBottom && index <= 8) {
            if (req.signal.aborted) throw new Error('ABORT_SIGNAL');

            const imageBuffer = await Promise.race([
                page.screenshot({ type: 'jpeg', quality: 60, fullPage: false }),
                abortPromise
            ]) as Buffer;

            // SAVE FILE (FIX 2)
            const fileName = `viewport-${index}.jpg`;
            const filePath = path.join(sessionPath, fileName);
            fs.writeFileSync(filePath, imageBuffer);

            const publicUrl = `/audit/${sessionName}/${fileName}`;

            // SEND TO GEMINI
            base64Frames.push({
                inlineData: {
                    data: imageBuffer.toString("base64"),
                    mimeType: "image/jpeg",
                },
            });

            const scrollStatus = await page.evaluate(() => {
                const current = window.pageYOffset + window.innerHeight;
                const total = document.documentElement.scrollHeight;
                return { isBottom: current >= total - 50 };
            });

            if (scrollStatus.isBottom) {
                isAtBottom = true;
            } else {
                await page.mouse.wheel({ deltaY: 800 });
                await new Promise(r => setTimeout(r, delay));
                index++;
            }
        }

        await browser.close();

        if (base64Frames.length === 0) {
            throw new Error("No screenshots captured");
        }

        // --- 6. GEMINI ANALYSIS (FIX 1) ---
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ]
        });

        const prompt = `
You are a Senior UX Architect and CRO Specialist. 
I have sent you ${base64Frames.length} screenshots of a website, captured sequentially from top to bottom.

Analyze the visual and technical UX/UI flow. 
Return a JSON ARRAY of objects. Each object MUST refer to a specific screenshot using 'imageIndex' (0 to ${base64Frames.length - 1}).

STRICT SCHEMA:
{
  "imageIndex": number,
  "section": "Hero" | "Features" | "Testimonials" | "Footer" | "General",
  "score": number (0-100),
  "level": "Critical" | "Needs Improvement" | "Optimal",
  "analysis": ["Point-based objective observation", "Another specific UI/UX finding"],
  "fix": ["Technical instruction 1", "Technical instruction 2"],
  "impact": "One sentence on how this affects business conversion/revenue."
}

TONE: Objective, professional, and data-driven. No roasting.
Return ONLY raw JSON.
`;

        const result = await model.generateContent([prompt, ...base64Frames]);
        const response = await result.response;
        let text = response.text();

        // --- 7. CLEAN & PARSE ---
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();

        let auditData;
        try {
            auditData = JSON.parse(text);
            console.log("\n🚀 TECHNICAL AUDIT COMPLETE:");
            console.log(JSON.stringify(auditData, null, 2));
        } catch {
            console.error("JSON Parse Error:", text);
            auditData = [{
                imageIndex: 0,
                section: "General",
                score: 0,
                level: "Critical",
                analysis: ["Failed to parse AI response."],
                fix: ["Refresh and try the scan again."],
                impact: "Technical failure prevents audit delivery."
            }];
        }

        return NextResponse.json({
            success: true,
            folder: sessionName,
            audit: auditData,
            device: "desktop"
        });

    } catch (error: any) {
        if (browser) await browser.close();

        if (error.message === 'ABORT_SIGNAL') {
            return new Response('Scan Aborted', { status: 499 });
        }

        console.error("Server Error:", error);

        return NextResponse.json({
            error: error.message || 'Internal Server Error'
        }, { status: 500 });
    }
}