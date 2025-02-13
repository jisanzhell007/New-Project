import "dotenv/config";
import express from "express";
import fetch from "node-fetch";
import { GoogleAuth } from "google-auth-library";
import path from "path";
import fs from "fs"; 
import { fileURLToPath } from "url";

// Temporary line to log environment variables
console.log("Environment Variables:", process.env.PROJECT_ID, process.env.LOCATION, process.env.MODEL_VERSION);

// Fix __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Validate required environment variables
const requiredEnvVars = ["PROJECT_ID", "LOCATION", "MODEL_VERSION"];
requiredEnvVars.forEach((varName) => {
    if (!process.env[varName]) {
        console.error(`❌ Missing required environment variable: ${varName}`);
        process.exit(1);
    }
});

// Load Google OAuth Authentication
const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, "service-account.json"), "utf8"));
const auth = new GoogleAuth({
    credentials: credentials,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"]
});

// Function to get an OAuth2 Access Token
async function getAccessToken() {
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    
    console.log("🔑 OAuth Token:", tokenResponse); // ✅ Debugging Step

    return tokenResponse.token;  // Ensure you return only the token string
}

// Root URL route to serve index.html
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// API Endpoint to Generate Images
app.post("/generate-image", async (req, res) => {
    const { cuisine, menuItems } = req.body;
    if (!cuisine || !menuItems) {
        return res.status(400).json({ error: "Cuisine and menu items are required." });
    }

    const prompt = `A high-resolution cover image of delicious ${cuisine} cuisine featuring ${menuItems}.`;
    console.log("Generated Prompt:", prompt);

    const PROJECT_ID = process.env.PROJECT_ID;
    const LOCATION = process.env.LOCATION;
    const MODEL_VERSION = process.env.MODEL_VERSION;

    // Construct the API URL
    const API_URL = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_VERSION}:predict`;

    try {
        // Get the access token
        const accessToken = await getAccessToken();

        // Send the request to the API
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                instances: [{ prompt }],
                parameters: { sampleCount: 2 }
            })
        });

        // Parse the response
        const data = await response.json();
        console.log("API Response:", data);

        // Handle the response
        if (data.predictions && data.predictions.length > 0) {
            res.json({
                images: data.predictions.map(img => `data:image/png;base64,${img.bytesBase64Encoded}`)
            });
        } else {
            res.status(500).json({ error: "No image generated." });
        }        
    } catch (error) {
        console.error("Error fetching images:", error);
        res.status(500).json({ error: "Failed to generate image." });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
});