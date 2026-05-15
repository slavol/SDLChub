import json

from google import genai
from google.genai import types

from backend.config import get_settings


settings = get_settings()

client = None
if settings.gemini_api_key:
    try:
        client = genai.Client(api_key=settings.gemini_api_key)
    except Exception as exc:
        print(f"⚠️ Error initializing Gemini Client: {exc}")
else:
    print("⚠️ GEMINI_API_KEY not found. AI features will use fallback responses.")


def _safe_json_loads(text: str) -> dict:
    clean_text = text.replace("```json", "").replace("```", "").strip()
    return json.loads(clean_text)


def get_methodology_recommendation(answers: dict):
    if not client:
        return {
            "recommended": "SCRUM",
            "confidence_score": 0,
            "reasoning": "AI service is not configured. Defaulting to Scrum for a structured project workflow.",
            "pros": ["Clear planning structure", "Good for predictable delivery"],
            "cons": ["May introduce overhead for highly reactive work"],
        }

    prompt = f"""
Act as a Senior Agile Coach. Analyze the following project characteristics and recommend the best methodology: SCRUM, KANBAN, or SCRUMBAN.

Project Characteristics:
1. Team Size: {answers.get('team_size')}
2. Work Nature: {answers.get('work_nature')}
3. Priority Volatility: {answers.get('volatility')}
4. Team Experience: {answers.get('experience')}
5. Desired Metrics: {answers.get('metrics')}

Return ONLY a JSON object with this exact structure:
{{
  "recommended": "SCRUM",
  "confidence_score": 85,
  "reasoning": "Short professional explanation, maximum 2 sentences.",
  "pros": ["Pro 1", "Pro 2"],
  "cons": ["Con 1"]
}}

The value for "recommended" must be exactly one of: SCRUM, KANBAN, SCRUMBAN.
"""

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0.2),
        )
        result = _safe_json_loads(response.text)

        if result.get("recommended") not in {"SCRUM", "KANBAN", "SCRUMBAN"}:
            result["recommended"] = "SCRUM"

        return result

    except Exception as exc:
        print(f"AI Error: {exc}")
        return {
            "recommended": "SCRUM",
            "confidence_score": 0,
            "reasoning": f"AI error occurred. Defaulting to Scrum. Details: {exc}",
            "pros": [],
            "cons": [],
        }


def get_role_suggestions(methodology: str, description: str):
    if not client:
        return {"roles": []}

    prompt = f"""
Suggest 3-4 key software team roles for a {methodology} project described as: "{description}".

Return ONLY a JSON object with this exact structure:
{{
  "roles": [
    {{ "name": "Role Name", "description": "Short description" }}
  ]
}}
"""

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0.2),
        )
        return _safe_json_loads(response.text)

    except Exception as exc:
        print(f"AI Error (Roles): {exc}")
        return {"roles": []}
