"""
Demo Interface for Humanitarian LLM
Simple Gradio interface for testing the model
"""

import gradio as gr
import json
from pathlib import Path


class HumanitarianLLMDemo:
    """Demo interface for humanitarian LLM"""
    
    def __init__(self, model_path: str = None):
        self.model_path = model_path
        self.model = None
        self.tokenizer = None
        
        # Load if model exists
        if model_path and Path(model_path).exists():
            self.load_model()
    
    def load_model(self):
        """Load the trained model"""
        try:
            from transformers import AutoModelForCausalLM, AutoTokenizer
            import torch
            
            print(f"Loading model from {self.model_path}...")
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_path)
            self.model = AutoModelForCausalLM.from_pretrained(
                self.model_path,
                device_map="auto",
                torch_dtype=torch.float16
            )
            print("✓ Model loaded successfully")
        except Exception as e:
            print(f"⚠️  Could not load model: {e}")
            print("   Using placeholder mode")
    
    def generate_response(self, question: str, max_length: int = 512) -> str:
        """Generate response to humanitarian question"""
        
        if self.model is None:
            # Placeholder response for demo
            return self._get_placeholder_response(question)
        
        system_prompt = "You are a humanitarian expert AI assistant specialized in crisis response and humanitarian standards."
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question}
        ]
        
        try:
            input_ids = self.tokenizer.apply_chat_template(
                messages,
                return_tensors="pt"
            ).to(self.model.device)
            
            outputs = self.model.generate(
                input_ids,
                max_new_tokens=max_length,
                temperature=0.7,
                do_sample=True,
                top_p=0.9
            )
            
            response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
            
            # Extract assistant response
            if "assistant" in response.lower():
                response = response.split("assistant")[-1].strip()
            
            return response
            
        except Exception as e:
            return f"Error generating response: {str(e)}"
    
    def _get_placeholder_response(self, question: str) -> str:
        """Placeholder responses for demo without trained model"""
        
        # Simple keyword-based responses for demo
        question_lower = question.lower()
        
        if "water" in question_lower:
            return "According to Sphere Standards, the minimum water requirement in emergencies is 15 liters per person per day. This covers drinking, cooking, and basic hygiene needs. In the immediate emergency phase, 7.5-15 liters may be provided initially, but should be increased to 15-20 liters as soon as possible. Water quality must meet WHO standards, and access points should be within 500 meters of households."
        
        elif "shelter" in question_lower:
            return "Emergency shelter provision should ensure 3.5 square meters of covered space per person. Key considerations include: 1) Climate-appropriate materials, 2) Cultural acceptability, 3) Protection from elements, 4) Privacy and dignity, 5) Safe location away from hazards, 6) Access to water and sanitation, and 7) Community input in design and implementation."
        
        elif "food" in question_lower or "nutrition" in question_lower:
            return "Food security assessment should examine: 1) Availability (physical supply), 2) Access (economic and physical ability to obtain), 3) Utilization (nutritional value and food safety), and 4) Stability (reliability over time). Acute malnutrition rates exceeding 15% GAM (Global Acute Malnutrition) indicate emergency conditions requiring immediate intervention."
        
        elif "protection" in question_lower:
            return "Core protection principles include: 1) Safety and dignity - avoid causing harm through our actions, 2) Meaningful access - ensure all can reach assistance without discrimination, 3) Accountability - establish feedback mechanisms, 4) Participation - involve affected communities meaningfully, and 5) Confidentiality - protect sensitive information. All humanitarian action must integrate protection considerations."
        
        elif "child" in question_lower:
            return "Child protection in emergencies prioritizes: 1) Family tracing and reunification for separated children, 2) Prevention of family separation during evacuation, 3) Interim care arrangements that are safe and appropriate, 4) Prevention of recruitment, trafficking, and exploitation, 5) Psychosocial support for trauma, 6) Access to education, and 7) Participation in decisions affecting them according to age and maturity."
        
        else:
            return "This is a demo version. For detailed humanitarian guidance, please consult: 1) Sphere Standards (spherestandards.org) for technical standards, 2) Core Humanitarian Standard (corehumanitarianstandard.org) for quality and accountability, 3) Protection principles and frameworks, and 4) Sector-specific guidelines from cluster lead agencies. Always prioritize safety, dignity, and do no harm principles in all humanitarian action."
    
    def create_interface(self):
        """Create Gradio interface"""
        
        # Example questions
        examples = [
            ["What is the minimum water requirement per person per day in emergencies?"],
            ["How should we assess shelter needs after a natural disaster?"],
            ["What are the core humanitarian principles?"],
            ["How do we protect children in emergency situations?"],
            ["What indicators suggest food insecurity?"]
        ]
        
        # Create interface
        with gr.Blocks(title="Humanitarian Expert LLM", theme=gr.themes.Soft()) as demo:
            gr.Markdown("""
            # 🌍 Humanitarian Expert LLM Demo
            
            This AI assistant is specialized in humanitarian crisis response, emergency operations, 
            and international humanitarian standards (Sphere, CHS, protection principles).
            
            **Note**: This is a demonstration. In production, always verify guidance with qualified 
            humanitarian professionals and current standards.
            """)
            
            with gr.Row():
                with gr.Column(scale=2):
                    question_input = gr.Textbox(
                        label="Your Question",
                        placeholder="Ask about humanitarian standards, emergency response, protection...",
                        lines=3
                    )
                    
                    submit_btn = gr.Button("Get Answer", variant="primary")
                    
                    gr.Examples(
                        examples=examples,
                        inputs=question_input,
                        label="Example Questions"
                    )
                
                with gr.Column(scale=3):
                    answer_output = gr.Textbox(
                        label="Expert Response",
                        lines=12,
                        show_copy_button=True
                    )
            
            gr.Markdown("""
            ---
            ### About This Model
            - **Training**: Fine-tuned on humanitarian standards and best practices
            - **Auditing**: Tested using PETRI framework for safety and bias
            - **Focus**: Sphere Standards, Core Humanitarian Standard, Protection Principles
            
            **Disclaimer**: AI-generated responses should be validated by humanitarian professionals. 
            Always refer to official guidance and consult experts for operational decisions.
            """)
            
            # Connect interface
            submit_btn.click(
                fn=self.generate_response,
                inputs=question_input,
                outputs=answer_output
            )
        
        return demo


def main():
    """Launch demo interface"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Humanitarian LLM Demo")
    parser.add_argument(
        "--model-path",
        type=str,
        default="./models/humanitarian-llm-poc",
        help="Path to trained model"
    )
    parser.add_argument(
        "--share",
        action="store_true",
        help="Create shareable link"
    )
    
    args = parser.parse_args()
    
    # Create demo
    demo_app = HumanitarianLLMDemo(args.model_path)
    interface = demo_app.create_interface()
    
    # Launch
    print("\n🚀 Launching Humanitarian LLM Demo...")
    print("📝 Note: Using placeholder responses until model is trained")
    
    interface.launch(
        share=args.share,
        server_name="0.0.0.0" if args.share else "127.0.0.1",
        server_port=7860
    )


if __name__ == "__main__":
    main()
