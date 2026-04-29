import requests
import os

API_KEY = os.getenv("OPENROUTER_API_KEY") or input("Enter your OpenRouter API key: ")
API_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "anthropic/claude-3-haiku"

print("\nType your message and press Enter. Type 'exit' to quit.\n")

while True:
    user_input = input("You: ")
    if user_input.lower() == "exit":
        break

    payload = {
        "model": MODEL,
        "messages": [
            {"role": "user", "content": user_input}
        ]
    }
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(API_URL, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()
        reply = data["choices"][0]["message"]["content"]
        print(f"Claude: {reply}\n")
    except Exception as e:
        print(f"Error: {e}\n")
