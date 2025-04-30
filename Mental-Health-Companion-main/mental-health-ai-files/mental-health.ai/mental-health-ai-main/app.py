from flask import Flask, render_template, request, jsonify, send_from_directory
import numpy as np
import pandas as pd
from transformers import pipeline
import speech_recognition as sr
from datetime import datetime
import os
import random
import google.generativeai as genai

app = Flask(__name__)

# Configure Gemini
GEMINI_API_KEY = "AIzaSyCmAN9xInS3TkWx-ocNXTHyL0yqtSg1UIU"
genai.configure(api_key=GEMINI_API_KEY)

# Model configuration
MODEL_NAME = "gemini-1.5-pro"

generation_config = {
    "temperature": 0.7,
    "top_p": 1,
    "top_k": 1,
}

safety_settings = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"}
]

model = genai.GenerativeModel(
    model_name=MODEL_NAME,
    generation_config=generation_config,
    safety_settings=safety_settings
)

# System instructions for Gemini
system_instructions = """You are a mental health assistant. Provide:
1. Short, empathetic responses (4-5 senetences max)
2. Practical coping strategies
3. Professional help recommendations
4. Crisis resources when needed
Never diagnose. .
"""

# Load AI models
sentiment_analyzer = pipeline("sentiment-analysis", model="distilbert-base-uncased-finetuned-sst-2-english")
emotion_classifier = pipeline("text-classification", model="bhadresh-savani/distilbert-base-uncased-emotion")

# Mock behavioral data storage
user_data = {
    "mood_history": [],
    "sleep_patterns": [],
    "activity_levels": [],
    "behavioral_logs": []
}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/dashboard/static/<path:filename>')
def dashboard_static(filename):
    return send_from_directory(os.path.join(app.root_path, 'static'), filename)

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        user_input = data.get('message', '').strip()
        
        if not user_input:
            return jsonify({"error": "Please enter a message"}), 400

        # Crisis detection
        crisis_keywords = ['suicide', 'kill myself', 'end my life', 'self-harm', 'hurting myself']
        if any(keyword in user_input.lower() for keyword in crisis_keywords):
            return jsonify({
                "response": "Please contact crisis support immediately:\n• US: Call 988\n• Text HOME to 741741\n• More resources: https://www.iasp.info/resources/Crisis_Centres/",
                "is_crisis": True
            })

        # Generate response using Gemini
        response = model.generate_content(
            f"[System]: {system_instructions}\n[User]: {user_input}",
            generation_config=generation_config
        )
        
        return jsonify({
            "response": response.text[:500],
            "is_crisis": False
        })

    except Exception as e:
        return jsonify({
            "error": "Error processing request",
            "details": str(e)
        }), 500

@app.route('/analyze_text', methods=['POST'])
def analyze_text():
    text = request.json['text']
    
    # Sentiment analysis
    sentiment = sentiment_analyzer(text)[0]
    
    # Emotion classification
    emotion = emotion_classifier(text)[0]
    
    # Store data
    timestamp = datetime.now().isoformat()
    user_data["mood_history"].append({
        "timestamp": timestamp,
        "text": text,
        "sentiment": sentiment,
        "emotion": emotion
    })
    
    # Enhanced risk assessment
    risk_level = "low"
    if emotion['score'] > 0.85:
        risk_level = "medium"
    if emotion['score'] > 0.95:
        risk_level = "high"
        
    # Check for crisis keywords
    crisis_keywords = ["suicide", "kill myself", "end it all", "can't go on", "don't want to live"]
    if any(keyword in text.lower() for keyword in crisis_keywords):
        risk_level = "high"
        crisis_response = "Please contact crisis support immediately:\n• US: Call 988\n• Text HOME to 741741\n• More resources: https://www.iasp.info/resources/Crisis_Centres/"
        return jsonify({
            "sentiment": sentiment,
            "emotion": emotion,
            "risk_level": risk_level,
            "response": crisis_response,
            "resources": get_resources(emotion['label']),
            "is_crisis": True
        })
    
    # Get response from Gemini
    try:
        response = model.generate_content(
            f"[System]: {system_instructions}\n[User]: {text}",
            generation_config=generation_config
        )
        chatbot_response = response.text[:500]
    except Exception as e:
        chatbot_response = "I'm here to listen. Would you like to share more about how you're feeling?"
    
    return jsonify({
        "sentiment": sentiment,
        "emotion": emotion,
        "risk_level": risk_level,
        "response": chatbot_response,
        "resources": get_resources(emotion['label']),
        "is_crisis": False
    })

def get_resources(emotion):
    resources = {
        "sadness": [
            "Guided meditation for sadness: 5-minute body scan",
            "Journaling prompts: 'What does my sadness need me to know today?'",
            "Comforting playlist: Soothing instrumental music",
            "Self-care idea: Warm tea and a cozy blanket"
        ],
        "anger": [
            "Anger management: 10-minute timeout technique",
            "Physical release: Try punching a pillow or screaming into one",
            "Cool-down exercise: Splash cold water on your face",
            "Perspective tool: 'Will this matter in 5 years?' worksheet"
        ],
        "fear": [
            "Anxiety reduction: 4-7-8 breathing technique",
            "Grounding exercise: Describe your surroundings in detail",
            "Worry containment: Set aside 15 minutes of 'worry time' later",
            "Safety reminder: Make a list of people you can call right now"
        ],
        "joy": [
            "Positive habits: Gratitude journal template",
            "Moment savoring: Take a mental photograph of this feeling",
            "Connection idea: Share your joy with someone else",
            "Energy channeling: Creative activity suggestions"
        ],
        "love": [
            "Relationship building: Active listening exercises",
            "Connection ideas: Meaningful questions to ask loved ones",
            "Self-love: Appreciation journal for yourself",
            "Kindness challenge: Random acts of kindness ideas"
        ],
        "surprise": [
            "Adaptation tools: Change management worksheet",
            "Perspective shift: 'What might be good about this?' exercise",
            "Stabilizing technique: Maintain your normal routine where possible",
            "Support system: Who can help you process this?"
        ]
    }
    return resources.get(emotion, [
        "General wellness tips",
        "Mindfulness meditation guide",
        "Daily self-care checklist",
        "Sleep hygiene recommendations"
    ])

@app.route('/analyze_audio', methods=['POST'])
def analyze_audio():
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400
    
    audio_file = request.files['audio']
    recognizer = sr.Recognizer()
    
    try:
        with sr.AudioFile(audio_file) as source:
            audio_data = recognizer.record(source)
            text = recognizer.recognize_google(audio_data)
            
            # Analyze the transcribed text
            return analyze_text(text)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/get_mood_history', methods=['GET'])
def get_mood_history():
    # Return mood history for visualization
    return jsonify({
        "mood_history": user_data["mood_history"],
        "stats": {
            "total_entries": len(user_data["mood_history"]),
            "recent_emotion": user_data["mood_history"][-1]["emotion"]["label"] if user_data["mood_history"] else None,
            "avg_sentiment": np.mean([entry["sentiment"]["score"] for entry in user_data["mood_history"]]) if user_data["mood_history"] else 0
        }
    })

@app.route('/api/behavioral-logs', methods=['GET', 'POST'])
def behavioral_logs():
    if request.method == 'GET':
        # Return all behavioral logs
        return jsonify(user_data["behavioral_logs"])
    elif request.method == 'POST':
        data = request.json
        # Validate required fields
        if 'mood' not in data:
            return jsonify({"error": "Mood is required"}), 400
        log_entry = {
            "date": datetime.now().isoformat(),
            "mood": data.get('mood'),
            "activities": data.get('activities', ''),
            "sleepHours": data.get('sleepHours', None),
            "notes": data.get('notes', '')
        }
        user_data["behavioral_logs"].append(log_entry)
        return jsonify({"message": "Log saved successfully"}), 201

if __name__ == '__main__':
    app.run(debug=True)