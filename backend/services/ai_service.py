import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

# Încărcăm variabilele
load_dotenv()

# Configurare Client (Singleton la nivel de modul)
api_key = os.getenv("GOOGLE_API_KEY")
client = None

if api_key:
    try:
        client = genai.Client(api_key=api_key)
    except Exception as e:
        print(f"⚠️ Error initializing Gemini Client: {e}")
else:
    print("⚠️ WARNING: GOOGLE_API_KEY not found in .env file.")

def generate_task_metadata(title: str, priority: str, context: str = "Software Development") -> str:
    """
    Serviciu care apelează Gemini pentru a genera descrierea task-ului.
    """
    if not client:
        raise Exception("Google AI Client not configured (Missing API Key).")

    prompt = f"""
    Role: Senior Technical Product Manager.
    Task: Write a concise task description for: "{title}".
    Priority: {priority}.
    Context: {context}.

    Output format (Markdown):
    ### User Story
    (As a... I want... So that...)

    ### Acceptance Criteria
    - [ ] Criteria 1
    - [ ] Criteria 2
    - [ ] Criteria 3

    ### Technical Notes
    (One brief sentence implementation hint)
    """

    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.3,
            )
        )
        
        return response.text if response.text else "AI generated empty response."
        
    except Exception as e:
        print(f"AI Service Error: {e}")
        raise e