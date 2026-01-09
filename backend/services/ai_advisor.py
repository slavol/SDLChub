from google import genai
from google.genai import types
import os
import json
from dotenv import load_dotenv

load_dotenv()

# Citim cheia
api_key = os.getenv("GOOGLE_API_KEY")

# Inițializăm clientul condiționat
client = None
if api_key:
    try:
        client = genai.Client(api_key=api_key)
    except Exception as e:
        print(f"⚠️ Error initializing Gemini Client: {e}")
else:
    print("⚠️ WARNING: GOOGLE_API_KEY not found in .env file. AI features will generate dummy data.")

def get_methodology_recommendation(answers: dict):
    """
    Analizează răspunsurile userului și recomandă o metodologie folosind Gemini.
    """
    
    # Fallback dacă clientul nu e configurat
    if not client:
        return {
            "recommended": "SCRUM",
            "confidence_score": 0,
            "reasoning": "AI Service not configured (Missing API Key). Defaulting to Scrum.",
            "pros": ["N/A"],
            "cons": ["N/A"]
        }

    prompt = f"""
    Act as a Senior Agile Coach. Analyze the following project characteristics and recommend the best methodology (SCRUM, KANBAN, or SCRUMBAN).
    
    Project Characteristics:
    1. Team Size: {answers.get('team_size')}
    2. Work Nature: {answers.get('work_nature')}
    3. Priority Volatility: {answers.get('volatility')}
    4. Team Experience: {answers.get('experience')}
    5. Desired Metrics: {answers.get('metrics')}
    
    Return ONLY a JSON object with this structure (no markdown, no extra text, no ```json wrappers):
    {{
        "recommended": "SCRUM" | "KANBAN" | "SCRUMBAN",
        "confidence_score": 85,
        "reasoning": "A short, professional explanation (max 2 sentences) why this fits best.",
        "pros": ["Pro 1", "Pro 2"],
        "cons": ["Con 1"]
    }}
    """
    
    try:
        # CORECTIE: Folosim gemini-1.5-flash (2.5 nu exista public)
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2,
            )
        )
        
        clean_text = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_text)
        
    except Exception as e:
        print(f"AI Error: {e}")
        return {
            "recommended": "SCRUM",
            "confidence_score": 0,
            "reasoning": f"AI Error: {str(e)}",
            "pros": [],
            "cons": []
        }

def get_role_suggestions(methodology: str, description: str):
    """
    Sugerează roluri bazate pe metodologie și descriere.
    """
    if not client:
        return {"roles": []}

    prompt = f"""
    Suggest 3-4 key software team roles for a {methodology} project described as: "{description}".
    Return ONLY a JSON object with this structure:
    {{
        "roles": [
            {{ "name": "Role Name", "description": "Short description" }}
        ]
    }}
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2,
            )
        )
        clean_text = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_text)
    except Exception as e:
        print(f"AI Error (Roles): {e}")
        return {"roles": []}