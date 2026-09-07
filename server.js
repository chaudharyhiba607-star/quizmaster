const http = require("http");
const fs = require("fs");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");
const multer = require("multer");
const { PDFParse } = require("pdf-parse");

const PORT = 3000;
const MODEL_NAME = "gemini-3.6-flash";

// =====================================================
// GEMINI SETUP
// =====================================================

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.log("");
    console.log("============================================");
    console.log("WARNING: GEMINI_API_KEY IS NOT SET");
    console.log("AI quiz generation will not work.");
    console.log("============================================");
    console.log("");
}

const ai = new GoogleGenAI({
    apiKey: apiKey
});

// =====================================================
// MULTER FILE UPLOAD
// =====================================================

const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 10 * 1024 * 1024
    }
});

// =====================================================
// JSON RESPONSE
// =====================================================

function sendJSON(res, statusCode, data) {

    if (res.headersSent) {
        return;
    }

    res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    });

    res.end(JSON.stringify(data));
}

// =====================================================
// GET ERROR MESSAGE
// =====================================================

function getErrorMessage(error) {

    if (!error) {
        return "Unknown server error.";
    }

    if (typeof error === "string") {
        return error;
    }

    if (error.message) {
        return error.message;
    }

    if (error.error && error.error.message) {
        return error.error.message;
    }

    try {
        return JSON.stringify(error);
    } catch {
        return "Unknown server error.";
    }
}

// =====================================================
// GET GEMINI RESPONSE TEXT
// =====================================================

function getGeminiText(response) {

    if (!response) {
        throw new Error(
            "Gemini returned no response."
        );
    }

    // Current @google/genai SDK
    if (
        typeof response.text === "string" &&
        response.text.trim()
    ) {
        return response.text.trim();
    }

    // Fallback in case response structure differs
    try {

        const text =
            response.candidates?.[0]?.content?.parts
                ?.map(part => part.text || "")
                .join("")
                .trim();

        if (text) {
            return text;
        }

    } catch (error) {
        console.error(
            "Could not read candidate response:",
            error
        );
    }

    console.error("");
    console.error("RAW GEMINI RESPONSE:");
    console.dir(response, {
        depth: 6
    });
    console.error("");

    throw new Error(
        "Gemini returned an empty response. Please try again."
    );
}

// =====================================================
// CLEAN JSON RETURNED BY GEMINI
// =====================================================

function cleanJSON(text) {

    if (!text) {
        throw new Error(
            "Gemini returned an empty response."
        );
    }

    let cleaned = String(text).trim();

    cleaned = cleaned.replace(
        /^```json\s*/i,
        ""
    );

    cleaned = cleaned.replace(
        /^```\s*/i,
        ""
    );

    cleaned = cleaned.replace(
        /\s*```$/i,
        ""
    );

    cleaned = cleaned.trim();

    const firstBrace =
        cleaned.indexOf("{");

    const lastBrace =
        cleaned.lastIndexOf("}");

    if (
        firstBrace !== -1 &&
        lastBrace !== -1 &&
        lastBrace > firstBrace
    ) {

        cleaned = cleaned.substring(
            firstBrace,
            lastBrace + 1
        );
    }

    try {

        return JSON.parse(cleaned);

    } catch (error) {

        console.error("");
        console.error(
            "============================================"
        );
        console.error(
            "INVALID JSON RECEIVED FROM GEMINI"
        );
        console.error(
            "============================================"
        );
        console.error(cleaned);
        console.error(
            "============================================"
        );

        throw new Error(
            "Gemini created the quiz but returned it in an invalid format. Please generate again."
        );
    }
}

// =====================================================
// DIFFICULTY
// =====================================================

function getDifficultyInstructions(difficulty) {

    switch (difficulty) {

        case "easy":

            return `
Create beginner-friendly questions.

Focus on:
- basic understanding
- important facts
- definitions
- simple concepts
- straightforward relationships

Avoid unnecessarily confusing wording.
`;

        case "hard":

            return `
Create challenging questions.

Focus on:
- deep understanding
- application
- reasoning
- comparison
- cause and effect
- connecting related concepts

Questions should be challenging because of the concept,
not because of confusing wording.
`;

        default:

            return `
Create moderately challenging questions.

Focus on:
- understanding
- application
- conceptual thinking
- connecting ideas
- important facts
- plausible distractors

Questions should be suitable for normal exam practice.
`;
    }
}

// =====================================================
// GENERATE QUIZ
// =====================================================

async function generateQuiz(
    subject,
    material,
    difficulty
) {

    if (!material || !material.trim()) {
        throw new Error(
            "Study material is empty."
        );
    }

    const difficultyInstructions =
        getDifficultyInstructions(
            difficulty
        );

    const prompt = `
You are QuizMaster AI, an educational quiz generator.

Create a student quiz using ONLY the supplied study material.

========================================
SUBJECT
========================================

${subject}

========================================
DIFFICULTY
========================================

${difficulty.toUpperCase()}

${difficultyInstructions}

========================================
STUDY MATERIAL
========================================

${material}

========================================
QUIZ REQUIREMENTS
========================================

Create EXACTLY 10 questions.

The quiz MUST contain:

6 Multiple Choice Questions
2 True/False Questions
2 Short Answer Questions

========================================
CONTENT RULES
========================================

Every question must be answerable using the supplied
study material.

DO NOT:

- invent facts
- use outside information
- add unsupported information
- create unrelated questions
- repeat the same question
- repeatedly test the exact same idea

========================================
MCQ RULES
========================================

Each MCQ must contain EXACTLY four options.

Options must:

- be plausible
- be related to the topic
- be different from one another
- have similar writing style
- have reasonably similar lengths

Never use:

- All of the above
- None of the above
- Both A and B
- None of these

Randomize where the correct answer appears.

========================================
TRUE FALSE RULES
========================================

Every True/False question must use:

"options": ["True", "False"]

========================================
SHORT ANSWER RULES
========================================

Short-answer questions should require concise answers
based directly on the supplied material.

========================================
SCORING
========================================

MCQ:
1 point

True/False:
1 point

Short Answer:
2 points

========================================
OUTPUT FORMAT
========================================

Return ONLY valid JSON.

Do not return markdown.
Do not use a code block.
Do not write anything before the JSON.
Do not write anything after the JSON.

Use this exact general structure:

{
  "title": "Quiz title",
  "difficulty": "${difficulty}",
  "questions": [
    {
      "type": "mcq",
      "question": "Question text",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "answer": "Correct option",
      "points": 1
    },
    {
      "type": "truefalse",
      "question": "Statement",
      "options": [
        "True",
        "False"
      ],
      "answer": "True",
      "points": 1
    },
    {
      "type": "short",
      "question": "Question text",
      "answer": "Expected answer",
      "points": 2
    }
  ]
}

IMPORTANT:

EXACTLY 10 questions.

EXACTLY:
6 MCQ
2 True/False
2 Short Answer
`;

    console.log("");
    console.log(
        "============================================"
    );
    console.log(
        "GENERATING QUIZ"
    );
    console.log(
        "============================================"
    );

    console.log(
        "Subject:",
        subject
    );

    console.log(
        "Difficulty:",
        difficulty
    );

    console.log(
        "Material characters:",
        material.length
    );

    console.log(
        "Model:",
        MODEL_NAME
    );

    console.log("");

    let response;

    try {

        response =
            await ai.models.generateContent({

                model: MODEL_NAME,

                contents: prompt,

                config: {

                    responseMimeType:
                        "application/json",

                    temperature:
                        0.6,

                    maxOutputTokens:
                        8192
                }
            });

    } catch (error) {

        console.error("");
        console.error(
            "GEMINI REQUEST FAILED"
        );
        console.error(error);
        console.error("");

        throw new Error(
            "Gemini API error: " +
            getErrorMessage(error)
        );
    }

    console.log(
        "Gemini response received."
    );

    const text =
        getGeminiText(response);

    console.log(
        "Gemini response contains text."
    );

    const quiz =
        cleanJSON(text);

    // =================================================
    // VALIDATION
    // =================================================

    if (
        !quiz ||
        typeof quiz !== "object"
    ) {

        throw new Error(
            "Gemini did not return a valid quiz."
        );
    }

    if (
        !Array.isArray(
            quiz.questions
        )
    ) {

        throw new Error(
            "Gemini did not return a questions list."
        );
    }

    if (
        quiz.questions.length !== 10
    ) {

        console.log(
            "WARNING: Gemini returned",
            quiz.questions.length,
            "questions instead of 10."
        );
    }

    quiz.questions.forEach(
        (question, index) => {

            if (
                !question ||
                typeof question !== "object"
            ) {

                throw new Error(
                    `Question ${index + 1} is invalid.`
                );
            }

            if (
                !question.type
            ) {

                throw new Error(
                    `Question ${index + 1} is missing its type.`
                );
            }

            if (
                !question.question
            ) {

                throw new Error(
                    `Question ${index + 1} is missing question text.`
                );
            }

            if (
                question.answer === undefined ||
                question.answer === null ||
                question.answer === ""
            ) {

                throw new Error(
                    `Question ${index + 1} is missing an answer.`
                );
            }

            // MCQ
            if (
                question.type === "mcq"
            ) {

                if (
                    !Array.isArray(
                        question.options
                    )
                ) {

                    throw new Error(
                        `MCQ ${index + 1} has no options.`
                    );
                }

                if (
                    question.options.length !== 4
                ) {

                    throw new Error(
                        `MCQ ${index + 1} must have exactly four options.`
                    );
                }

                question.points = 1;
            }

            // TRUE/FALSE
            else if (
                question.type ===
                "truefalse"
            ) {

                question.options = [
                    "True",
                    "False"
                ];

                question.points = 1;
            }

            // SHORT
            else if (
                question.type ===
                "short"
            ) {

                delete question.options;

                question.points = 2;
            }

            else {

                throw new Error(
                    `Question ${index + 1} has unknown type "${question.type}".`
                );
            }
        }
    );

    if (!quiz.title) {
        quiz.title =
            subject + " Quiz";
    }

    quiz.difficulty =
        difficulty;

    console.log("");
    console.log(
        "============================================"
    );
    console.log(
        "QUIZ GENERATED SUCCESSFULLY"
    );
    console.log(
        "Questions:",
        quiz.questions.length
    );
    console.log(
        "============================================"
    );
    console.log("");

    return quiz;
}

// =====================================================
// CREATE HTTP SERVER
// =====================================================

const server =
    http.createServer(
        async (req, res) => {

            // =========================================
            // CORS
            // =========================================

            if (
                req.method === "OPTIONS"
            ) {

                res.writeHead(
                    204,
                    {
                        "Access-Control-Allow-Origin":
                            "*",

                        "Access-Control-Allow-Methods":
                            "GET, POST, OPTIONS",

                        "Access-Control-Allow-Headers":
                            "Content-Type"
                    }
                );

                res.end();

                return;
            }

            const requestURL =
                req.url.split("?")[0];

            // =========================================
            // HEALTH CHECK
            // =========================================

            if (
                requestURL ===
                    "/api/health" &&
                req.method === "GET"
            ) {

                return sendJSON(
                    res,
                    200,
                    {
                        status:
                            "QuizMaster server is working!",

                        aiModel:
                            MODEL_NAME,

                        apiKeyConfigured:
                            !!apiKey
                    }
                );
            }

            // =========================================
            // GENERATE QUIZ API
            // =========================================

            if (
                requestURL ===
                    "/api/generate-quiz" &&
                req.method === "POST"
            ) {

                let body = "";

                req.on(
                    "data",
                    chunk => {

                        body +=
                            chunk.toString();

                        if (
                            body.length >
                            5 * 1024 * 1024
                        ) {

                            console.error(
                                "Request body too large."
                            );
                        }
                    }
                );

                req.on(
                    "end",
                    async () => {

                        try {

                            if (!apiKey) {

                                return sendJSON(
                                    res,
                                    500,
                                    {
                                        error:
                                            "Gemini API key is not configured. Restart QuizMaster after setting GEMINI_API_KEY."
                                    }
                                );
                            }

                            if (!body) {

                                return sendJSON(
                                    res,
                                    400,
                                    {
                                        error:
                                            "QuizMaster received an empty request."
                                    }
                                );
                            }

                            let data;

                            try {

                                data =
                                    JSON.parse(
                                        body
                                    );

                            } catch (error) {

                                console.error(
                                    "Invalid request JSON:",
                                    body
                                );

                                return sendJSON(
                                    res,
                                    400,
                                    {
                                        error:
                                            "QuizMaster received invalid data from the website."
                                    }
                                );
                            }

                            const subject =
                                typeof data.subject ===
                                    "string" &&
                                data.subject.trim()
                                    ?
                                    data.subject.trim()
                                    :
                                    "General Knowledge";

                            const material =
                                typeof data.material ===
                                    "string"
                                    ?
                                    data.material.trim()
                                    :
                                    "";

                            let difficulty =
                                typeof data.difficulty ===
                                    "string"
                                    ?
                                    data.difficulty
                                        .trim()
                                        .toLowerCase()
                                    :
                                    "medium";

                            if (
                                !material
                            ) {

                                return sendJSON(
                                    res,
                                    400,
                                    {
                                        error:
                                            "Please enter or upload study material before generating the quiz."
                                    }
                                );
                            }

                            if (
                                ![
                                    "easy",
                                    "medium",
                                    "hard"
                                ].includes(
                                    difficulty
                                )
                            ) {

                                difficulty =
                                    "medium";
                            }

                            const quiz =
                                await generateQuiz(
                                    subject,
                                    material,
                                    difficulty
                                );

                            return sendJSON(
                                res,
                                200,
                                {
                                    success: true,
                                    ...quiz
                                }
                            );

                        } catch (error) {

                            const message =
                                getErrorMessage(
                                    error
                                );

                            console.error("");
                            console.error(
                                "============================================"
                            );
                            console.error(
                                "QUIZ GENERATION ERROR"
                            );
                            console.error(
                                "============================================"
                            );
                            console.error(
                                message
                            );
                            console.error(error);
                            console.error(
                                "============================================"
                            );
                            console.error("");

                            return sendJSON(
                                res,
                                500,
                                {
                                    success:
                                        false,

                                    error:
                                        message
                                }
                            );
                        }
                    }
                );

                req.on(
                    "error",
                    error => {

                        console.error(
                            "Request error:",
                            error
                        );

                        if (
                            !res.headersSent
                        ) {

                            sendJSON(
                                res,
                                500,
                                {
                                    error:
                                        "The request could not be processed."
                                }
                            );
                        }
                    }
                );

                return;
            }

            // =========================================
            // UPLOAD MATERIAL API
            // =========================================

            if (
                requestURL ===
                    "/api/upload-material" &&
                req.method === "POST"
            ) {

                upload.single("file")(
                    req,
                    res,
                    async uploadError => {

                        try {

                            if (
                                uploadError
                            ) {

                                return sendJSON(
                                    res,
                                    400,
                                    {
                                        error:
                                            uploadError.message ||
                                            "File upload failed."
                                    }
                                );
                            }

                            if (
                                !req.file
                            ) {

                                return sendJSON(
                                    res,
                                    400,
                                    {
                                        error:
                                            "Please select a file first."
                                    }
                                );
                            }

                            const file =
                                req.file;

                            const type =
                                file.mimetype ||
                                "";

                            console.log("");
                            console.log(
                                "============================================"
                            );
                            console.log(
                                "FILE RECEIVED"
                            );
                            console.log(
                                "============================================"
                            );

                            console.log(
                                "Name:",
                                file.originalname
                            );

                            console.log(
                                "Type:",
                                type
                            );

                            console.log(
                                "Size:",
                                file.size,
                                "bytes"
                            );

                            // =================================
                            // PDF
                            // =================================

                            if (
                                type ===
                                "application/pdf"
                            ) {

                                console.log(
                                    "Reading PDF..."
                                );

                                let parser;

                                try {

                                    parser =
                                        new PDFParse({
                                            data:
                                                file.buffer
                                        });

                                    const result =
                                        await parser.getText();

                                    const pdfText =
                                        result &&
                                        typeof result.text ===
                                            "string"
                                            ?
                                            result.text.trim()
                                            :
                                            "";

                                    if (
                                        typeof parser.destroy ===
                                        "function"
                                    ) {

                                        await parser.destroy();
                                    }

                                    if (
                                        !pdfText
                                    ) {

                                        return sendJSON(
                                            res,
                                            400,
                                            {
                                                error:
                                                    "The PDF contains no readable text. Try another PDF."
                                            }
                                        );
                                    }

                                    console.log(
                                        "PDF successfully read."
                                    );

                                    console.log(
                                        "Characters:",
                                        pdfText.length
                                    );

                                    return sendJSON(
                                        res,
                                        200,
                                        {
                                            success:
                                                true,

                                            type:
                                                "pdf",

                                            text:
                                                pdfText
                                        }
                                    );

                                } catch (
                                    pdfError
                                ) {

                                    if (
                                        parser &&
                                        typeof parser.destroy ===
                                            "function"
                                    ) {

                                        try {

                                            await parser.destroy();

                                        } catch {
                                            // Ignore cleanup error
                                        }
                                    }

                                    console.error(
                                        "PDF ERROR:",
                                        pdfError
                                    );

                                    return sendJSON(
                                        res,
                                        400,
                                        {
                                            error:
                                                "The PDF could not be read. " +
                                                getErrorMessage(
                                                    pdfError
                                                )
                                        }
                                    );
                                }
                            }

                            // =================================
                            // TEXT FILE
                            // =================================

                            if (
                                type ===
                                    "text/plain" ||
                                path.extname(
                                    file.originalname
                                )
                                    .toLowerCase() ===
                                    ".txt"
                            ) {

                                const text =
                                    file.buffer
                                        .toString(
                                            "utf8"
                                        )
                                        .trim();

                                if (!text) {

                                    return sendJSON(
                                        res,
                                        400,
                                        {
                                            error:
                                                "The text file is empty."
                                        }
                                    );
                                }

                                console.log(
                                    "Text file successfully read."
                                );

                                return sendJSON(
                                    res,
                                    200,
                                    {
                                        success:
                                            true,

                                        type:
                                            "text",

                                        text:
                                            text
                                    }
                                );
                            }

                            // =================================
                            // IMAGE
                            // =================================

                            if (
                                type.startsWith(
                                    "image/"
                                )
                            ) {

                                if (!apiKey) {

                                    return sendJSON(
                                        res,
                                        500,
                                        {
                                            error:
                                                "Gemini API key is not configured."
                                        }
                                    );
                                }

                                console.log(
                                    "Reading image with Gemini..."
                                );

                                const base64Data =
                                    file.buffer.toString(
                                        "base64"
                                    );

                                let imageResponse;

                                try {

                                    imageResponse =
                                        await ai.models
                                            .generateContent(
                                                {

                                                    model:
                                                        MODEL_NAME,

                                                    contents:
                                                        [
                                                            {
                                                                role:
                                                                    "user",

                                                                parts:
                                                                    [
                                                                        {
                                                                            inlineData:
                                                                                {
                                                                                    mimeType:
                                                                                        type,

                                                                                    data:
                                                                                        base64Data
                                                                                }
                                                                        },

                                                                        {
                                                                            text:
                                                                                `
Read all educational study material visible in this image.

Extract useful:
- notes
- facts
- definitions
- formulas
- examples
- concepts
- headings

Return ONLY the extracted study material as plain text.

Do not invent anything.
Do not add outside information.
`
                                                                        }
                                                                    ]
                                                            }
                                                        ]
                                                }
                                            );

                                } catch (
                                    imageError
                                ) {

                                    console.error(
                                        "Gemini image error:",
                                        imageError
                                    );

                                    return sendJSON(
                                        res,
                                        500,
                                        {
                                            error:
                                                "Gemini could not process the image: " +
                                                getErrorMessage(
                                                    imageError
                                                )
                                        }
                                    );
                                }

                                const extractedText =
                                    getGeminiText(
                                        imageResponse
                                    );

                                if (
                                    !extractedText
                                ) {

                                    return sendJSON(
                                        res,
                                        400,
                                        {
                                            error:
                                                "No readable study material was found in the image."
                                        }
                                    );
                                }

                                console.log(
                                    "Image successfully read."
                                );

                                console.log(
                                    "Characters:",
                                    extractedText.length
                                );

                                return sendJSON(
                                    res,
                                    200,
                                    {
                                        success:
                                            true,

                                        type:
                                            "image",

                                        text:
                                            extractedText
                                    }
                                );
                            }

                            return sendJSON(
                                res,
                                400,
                                {
                                    error:
                                        "Unsupported file. Please upload a PDF, TXT file, JPG, JPEG or PNG image."
                                }
                            );

                        } catch (error) {

                            const message =
                                getErrorMessage(
                                    error
                                );

                            console.error("");
                            console.error(
                                "============================================"
                            );
                            console.error(
                                "UPLOAD ERROR"
                            );
                            console.error(
                                "============================================"
                            );
                            console.error(
                                message
                            );
                            console.error(error);
                            console.error(
                                "============================================"
                            );

                            return sendJSON(
                                res,
                                500,
                                {
                                    error:
                                        message
                                }
                            );
                        }
                    }
                );

                return;
            }

            // =========================================
            // WEBSITE FILES
            // =========================================

            let requestedPath;

            try {

                requestedPath =
                    decodeURIComponent(
                        requestURL
                    );

            } catch {

                requestedPath =
                    requestURL;
            }

            let filePath;

            if (
                requestedPath === "/"
            ) {

                // Your server folder is inside QuizMaster
                // and index.html is one folder above it.
                filePath =
                    path.join(
                        __dirname,
                        "..",
                        "index.html"
                    );

            } else {

                const cleanPath =
                    requestedPath.replace(
                        /^\/+/,
                        ""
                    );

                filePath =
                    path.join(
                        __dirname,
                        "..",
                        cleanPath
                    );
            }

            fs.readFile(
                filePath,
                (error, data) => {

                    if (error) {

                        res.writeHead(
                            404,
                            {
                                "Content-Type":
                                    "text/plain; charset=utf-8"
                            }
                        );

                        res.end(
                            "File not found."
                        );

                        return;
                    }

                    const extension =
                        path.extname(
                            filePath
                        )
                            .toLowerCase();

                    const contentTypes =
                        {
                            ".html":
                                "text/html; charset=utf-8",

                            ".css":
                                "text/css; charset=utf-8",

                            ".js":
                                "application/javascript; charset=utf-8",

                            ".json":
                                "application/json; charset=utf-8",

                            ".png":
                                "image/png",

                            ".jpg":
                                "image/jpeg",

                            ".jpeg":
                                "image/jpeg",

                            ".gif":
                                "image/gif",

                            ".svg":
                                "image/svg+xml",

                            ".ico":
                                "image/x-icon",

                            ".pdf":
                                "application/pdf"
                        };

                    const contentType =
                        contentTypes[
                            extension
                        ] ||
                        "application/octet-stream";

                    res.writeHead(
                        200,
                        {
                            "Content-Type":
                                contentType
                        }
                    );

                    res.end(data);
                }
            );
        }
    );

// =====================================================
// SERVER ERROR
// =====================================================

server.on(
    "error",
    error => {

        console.error("");
        console.error(
            "SERVER ERROR:"
        );
        console.error(error);
        console.error("");

        if (
            error.code ===
            "EADDRINUSE"
        ) {

            console.error(
                `Port ${PORT} is already being used.`
            );

            console.error(
                "Close the old QuizMaster Command Prompt window and start it again."
            );
        }
    }
);

// =====================================================
// START QUIZMASTER
// =====================================================

server.listen(
    PORT,
    () => {

        console.log("");
        console.log(
            "============================================"
        );
        console.log(
            "              QUIZMASTER"
        );
        console.log(
            "============================================"
        );

        console.log(
            `Website: http://localhost:${PORT}`
        );

        console.log(
            `AI Model: ${MODEL_NAME}`
        );

        console.log(
            "Gemini API Key:",
            apiKey
                ? "CONFIGURED"
                : "NOT CONFIGURED"
        );

        console.log(
            "============================================"
        );

        console.log(
            "QuizMaster is READY!"
        );

        console.log(
            "============================================"
        );

        console.log("");
    }
);