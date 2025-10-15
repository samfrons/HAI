"""
Gradio Demo App for Humanitarian AI Model
Launch this after training to test your model
"""

import gradio as gr
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
import os

print("🌍 Humanitarian AI Demo App")
print("="*60)

# Configuration
MODEL_PATH = "./humanitarian-model"
BASE_MODEL = "meta-llama/Llama-3.2-3B-Instruct"

# Check if model exists
if not os.path.exists(MODEL_PATH):
    print(f"\n⚠️  Model not found at: {MODEL_PATH}")
    print("   Please train the model first (run train.py)")
    print("   Or update MODEL_PATH to point to your model directory")
    exit(1)

print(f"\n📦 Loading model from: {MODEL_PATH}")
print("   This may take 2-3 minutes...")

# Load tokenizer
print("\n1️⃣  Loading tokenizer...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
print("✅ Tokenizer loaded")

# Load base model
print("\n2️⃣  Loading base model...")
model = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL,
    device_map="auto",
    torch_dtype=torch.float16,
    load_in_4bit=True
)
print("✅ Base model loaded")

# Load LoRA weights
print("\n3️⃣  Loading LoRA adapter...")
model = PeftModel.from_pretrained(model, MODEL_PATH)
print("✅ LoRA adapter loaded")

print("\n✅ Model ready for inference!")
print("="*60)

def generate_response(question, max_length=512, temperature=0.7):
    """Generate response to humanitarian question"""

    # Format as chat
    system_prompt = (
        "You are a humanitarian expert AI assistant specialized in crisis response, "
        "humanitarian standards, and emergency operations. You provide accurate, "
        "actionable guidance based on established frameworks like Sphere Standards, "
        "Core Humanitarian Standard, and protection principles."
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": question}
    ]

    # Tokenize
    input_ids = tokenizer.apply_chat_template(
        messages,
        return_tensors="pt",
        add_generation_prompt=True
    ).to(model.device)

    # Generate
    with torch.no_grad():
        outputs = model.generate(
            input_ids,
            max_new_tokens=max_length,
            temperature=temperature,
            do_sample=True,
            top_p=0.9,
            repetition_penalty=1.1
        )

    # Decode
    response = tokenizer.decode(outputs[0], skip_special_tokens=True)

    # Extract assistant response
    if "assistant" in response.lower():
        parts = response.lower().split("assistant")
        if len(parts) > 1:
            response = response.split("assistant")[-1].strip()

    # Clean up
    response = response.strip()
    if response.startswith(":"):
        response = response[1:].strip()

    return response

# Example questions
examples = [
    ["What are the statistics on humanitarian funding annually?"],
    ["How should humanitarian responders address natural disaster situations?"],
    ["What is GDPR compliance in humanitarian context?"],
    ["What are the key indicators of food insecurity in crisis situations?"],
    ["How do you assess shelter needs after a natural disaster?"],
]

# Create Gradio interface
demo = gr.Interface(
    fn=generate_response,
    inputs=[
        gr.Textbox(
            label="Ask a Humanitarian Question",
            placeholder="E.g., What are the statistics on humanitarian funding?",
            lines=3
        ),
        gr.Slider(
            minimum=100,
            maximum=1024,
            value=512,
            step=50,
            label="Max Response Length"
        ),
        gr.Slider(
            minimum=0.1,
            maximum=1.5,
            value=0.7,
            step=0.1,
            label="Temperature (Higher = More Creative)"
        )
    ],
    outputs=gr.Textbox(
        label="AI Response",
        lines=10
    ),
    title="🌍 Humanitarian AI Expert",
    description=(
        "This AI model has been fine-tuned on humanitarian knowledge including crisis response, "
        "Sphere Standards, protection principles, and emergency operations. "
        "Ask questions about humanitarian standards, statistics, or crisis response."
    ),
    examples=examples,
    theme=gr.themes.Soft(),
    allow_flagging="never"
)

if __name__ == "__main__":
    print("\n🚀 Launching Gradio demo...")
    print("   Access the interface using the URL shown below")
    print("   For Colab: Click the public URL to access from anywhere\n")

    demo.launch(
        share=True,  # Creates public URL for Colab
        server_name="0.0.0.0",
        server_port=7860
    )
