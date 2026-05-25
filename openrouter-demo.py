import requests
import json
import base64, re
import os
from dotenv import load_dotenv

load_dotenv()


response = requests.post(
  url="https://openrouter.ai/api/v1/chat/completions",
  headers={
    "Authorization": f"Bearer {os.environ['OPENROUTER_API_KEY']}",
    "Content-Type": "application/json",
  },
  data=json.dumps({
    "model": "google/gemini-3.1-flash-image-preview",
    "messages": [
        {
          "role": "user",
          "content": "Generate a beautiful sunset over mountains"
        }
      ],
    "modalities": ["image", "text"]
  })
)

result = response.json()

if result.get("choices"):
    message = result["choices"][0]["message"]
    if message.get("images"):
        for i, image in enumerate(message["images"]):
            data_url = image["image_url"]["url"]
            b64_data = re.sub(r"^data:image/\w+;base64,", "", data_url)
            with open(f"image_{i}.png", "wb") as f:
                f.write(base64.b64decode(b64_data))
            print(f"Saved image_{i}.png")
