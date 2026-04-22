const express = require('express');
const multer = require('multer');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config();

// Initialize Gemini API
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const app = express();
const PORT = process.env.PORT || 3000;

// Set up temporary storage for uploaded images
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Provide static directory for frontend
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// In-memory storage for scan data
const scanRecords = [
    { date: new Date(Date.now() - 6*24*60*60*1000), disease: 'Leaf rust' },
    { date: new Date(Date.now() - 5*24*60*60*1000), disease: 'Stripe rust' },
    { date: new Date(Date.now() - 4*24*60*60*1000), disease: 'Healthy' },
    { date: new Date(Date.now() - 3*24*60*60*1000), disease: 'Stem rust' },
    { date: new Date(Date.now() - 2*24*60*60*1000), disease: 'Leaf rust' },
    { date: new Date(Date.now() - 1*24*60*60*1000), disease: 'Blight' },
];

app.get('/api/stats', (req, res) => {
    res.json(scanRecords);
});

// Main Image Analysis Endpoint
app.post('/api/analyze', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image uploaded' });
        }
        
        // Convert file to expected format
        const imageBuffer = fs.readFileSync(req.file.path);
        
        // Ensure strict prompt for detection
        const promptText = `You are an expert plant pathologist specializing in wheat diseases. Analyze this image of a wheat plant.
        Identify if it has any of these diseases: 'Leaf rust', 'Stripe rust', 'Stem rust', 'Powdery mildew', 'Blight', or if it is 'Healthy'.
        If a disease is detected, provide the disease name, your confidence level, and actionable treatment suggestions for farmers.
        Provide your response in JSON format exactly like this:
        {
            "diagnosis": "Disease Name or Healthy",
            "confidence": "e.g., 95%",
            "description": "Brief description of the symptoms observed",
            "treatment": [ "Treatment 1", "Treatment 2" ]
        }`;

        // Call the new SDK method
        const response = await genAI.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [
                promptText,
                {
                    inlineData: {
                        mimeType: req.file.mimetype,
                        data: imageBuffer.toString('base64')
                    }
                }
            ]
        });

        const responseText = response.text;
        
        // Try parsing the JSON response
        let aiData;
        try {
            // Remove markdown code blocks if any
            const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            aiData = JSON.parse(cleanedText);
            
            // Add to our records
            if (aiData.diagnosis) {
                scanRecords.push({
                    date: new Date(),
                    disease: aiData.diagnosis
                });
            }
        } catch (e) {
            console.error("Failed to parse JSON from Gemini", responseText);
            aiData = { error: "Failed to structure response from AI", raw: responseText };
        }

        // Optional: Clean up uploaded file after processing
        fs.unlinkSync(req.file.path);
        
        res.json({
            success: true,
            data: aiData
        });
    } catch (error) {
        console.error('Error in analyze endpoint:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
