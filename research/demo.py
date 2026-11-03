#!/usr/bin/env python3
"""
HAI Demo — Standalone humanitarian AI assistant demo.

RAG-powered chat interface using the curated humanitarian knowledge base.
Works without Ollama or Supabase — uses template-based responses with
real retrieved context from the knowledge base.

Usage:
    pip install gradio scikit-learn numpy
    python demo.py
"""

import json
import os
import re
from pathlib import Path

try:
    import gradio as gr
except ImportError:
    raise SystemExit("Install gradio: pip install gradio")

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    import numpy as np
except ImportError:
    raise SystemExit("Install sklearn: pip install scikit-learn numpy")


# ---------------------------------------------------------------------------
# Knowledge Base Loader
# ---------------------------------------------------------------------------

KB_PATH = Path(__file__).parent / "data" / "processed" / "humanitarian_knowledge.json"
SCENARIOS_PATH = Path(__file__).parent.parent / "petri" / "seeds" / "humanitarian_test_scenarios.json"


def load_knowledge_base():
    """Load and flatten the knowledge base into searchable chunks."""
    if not KB_PATH.exists():
        return [], []

    with open(KB_PATH) as f:
        kb = json.load(f)

    chunks = []
    metadata = []

    # Crisis types
    for item in kb.get("crisis_types", []):
        text = f"Crisis type: {item['type']}. {item.get('definition', '')} "
        if "indicators" in item:
            text += f"Indicators: {', '.join(item['indicators'])}. "
        if "response_priorities" in item:
            text += f"Response priorities: {', '.join(item['response_priorities'])}. "
        if "example_events" in item:
            text += f"Examples: {', '.join(item['example_events'])}."
        chunks.append(text)
        metadata.append({"section": f"Crisis: {item['type']}", "source": "HAI Knowledge Base"})

    # Statistics
    for item in kb.get("statistics", []):
        text = f"{item['stat']}. Year: {item.get('year', 'N/A')}. Context: {item.get('context', '')}. Source: {item.get('source', 'N/A')}."
        chunks.append(text)
        metadata.append({"section": f"Statistic: {item['stat'][:60]}", "source": item.get("source", "HAI Knowledge Base")})

    # Terminology
    terms = kb.get("terminology", {})
    for term, definition in terms.items():
        text = f"{term}: {definition}"
        chunks.append(text)
        metadata.append({"section": f"Term: {term}", "source": "HAI Knowledge Base"})

    # Platforms
    for item in kb.get("platforms", []):
        text = f"{item['name']}: {item['description']}. "
        if "managed_by" in item:
            text += f"Managed by {item['managed_by']}. "
        if "data_types" in item:
            text += f"Data types: {', '.join(item['data_types'])}."
        chunks.append(text)
        metadata.append({"section": f"Platform: {item['name']}", "source": "HAI Knowledge Base"})

    # Workflows
    for item in kb.get("workflows", []):
        text = f"Workflow — {item['type']}: {item.get('description', '')}. Steps: {' '.join(item.get('steps', []))}"
        chunks.append(text)
        metadata.append({"section": f"Workflow: {item['type']}", "source": "HAI Knowledge Base"})

    # Decision frameworks
    for item in kb.get("decision_frameworks", []):
        text = f"Framework — {item['name']}: {item.get('description', '')}."
        for key in ("phases", "criteria", "priorities", "risk_categories"):
            if key in item:
                for phase in item[key]:
                    if isinstance(phase, dict):
                        text += f" {phase.get('name', phase.get('criterion', phase.get('category', '')))}:"
                        text += f" {phase.get('description', phase.get('question', phase.get('action', phase.get('examples', ''))))}."
        chunks.append(text)
        metadata.append({"section": f"Framework: {item['name']}", "source": "HAI Knowledge Base"})

    # Best practices
    for item in kb.get("best_practices", []):
        text = f"Best practice ({item['area']}): {item['practice']}. Rationale: {item['rationale']}. Reference: {item.get('reference', 'N/A')}."
        chunks.append(text)
        metadata.append({"section": f"Practice: {item['area']}", "source": item.get("reference", "HAI Knowledge Base")})

    # Case studies
    for item in kb.get("case_studies", []):
        text = f"Case study — {item['title']}: {item['context']}. "
        if "key_facts" in item:
            text += f"Facts: {' '.join(item['key_facts'])}. "
        if "lessons_learned" in item:
            text += f"Lessons: {' '.join(item['lessons_learned'])}."
        chunks.append(text)
        metadata.append({"section": f"Case: {item['title']}", "source": "HAI Knowledge Base"})

    # Sphere standards
    sphere = kb.get("sphere_standards", {})
    for sector, content in sphere.items():
        if isinstance(content, dict):
            if "standard" in content:
                text = f"Sphere {sector}: {content['standard']}. Minimum: {content['minimum']}."
                if "indicators" in content:
                    text += f" Indicators: {' '.join(content['indicators'])}."
                chunks.append(text)
                metadata.append({"section": f"Sphere: {sector}", "source": "Sphere Handbook 2018"})
            else:
                for subsector, subcontent in content.items():
                    if isinstance(subcontent, dict) and "standard" in subcontent:
                        text = f"Sphere {sector}/{subsector}: {subcontent['standard']}. Minimum: {subcontent['minimum']}."
                        if "indicators" in subcontent:
                            text += f" Indicators: {' '.join(subcontent['indicators'])}."
                        chunks.append(text)
                        metadata.append({"section": f"Sphere: {sector}/{subsector}", "source": "Sphere Handbook 2018"})

    return chunks, metadata


# ---------------------------------------------------------------------------
# RAG Engine
# ---------------------------------------------------------------------------

class RAGEngine:
    def __init__(self):
        self.chunks, self.metadata = load_knowledge_base()
        self.vectorizer = None
        self.tfidf_matrix = None
        if self.chunks:
            self.vectorizer = TfidfVectorizer(
                stop_words="english",
                max_features=5000,
                ngram_range=(1, 2),
            )
            self.tfidf_matrix = self.vectorizer.fit_transform(self.chunks)

    def search(self, query, top_k=5):
        if not self.chunks or self.vectorizer is None:
            return []
        query_vec = self.vectorizer.transform([query])
        scores = cosine_similarity(query_vec, self.tfidf_matrix).flatten()
        top_indices = np.argsort(scores)[::-1][:top_k]
        results = []
        for idx in top_indices:
            if scores[idx] > 0.05:
                results.append({
                    "text": self.chunks[idx],
                    "score": float(scores[idx]),
                    "section": self.metadata[idx]["section"],
                    "source": self.metadata[idx]["source"],
                })
        return results


# ---------------------------------------------------------------------------
# Response Generator
# ---------------------------------------------------------------------------

class ResponseGenerator:
    def __init__(self, rag: RAGEngine):
        self.rag = rag
        self.ollama_available = False
        self._check_ollama()

    def _check_ollama(self):
        try:
            import ollama
            models = ollama.list()
            self.ollama_available = len(models.get("models", [])) > 0
            if self.ollama_available:
                self.ollama_model = models["models"][0]["name"]
        except Exception:
            self.ollama_available = False

    def generate(self, query, history=None):
        results = self.rag.search(query, top_k=5)

        if self.ollama_available:
            return self._generate_ollama(query, results, history)
        return self._generate_template(query, results)

    def _generate_ollama(self, query, results, history):
        import ollama

        context = "\n\n".join(
            f"[{r['section']}] ({r['source']})\n{r['text']}" for r in results
        )

        messages = [
            {"role": "system", "content": (
                "You are HAI, a humanitarian AI assistant. Answer using ONLY the "
                "provided context. Cite sources. If the context doesn't cover the "
                "question, say so — never invent figures or standards.\n\n"
                f"Context:\n{context}"
            )},
        ]

        if history:
            for h_query, h_response in history[-3:]:
                messages.append({"role": "user", "content": h_query})
                messages.append({"role": "assistant", "content": h_response})

        messages.append({"role": "user", "content": query})

        try:
            response = ollama.chat(model=self.ollama_model, messages=messages)
            answer = response["message"]["content"]
            return answer, results
        except Exception as e:
            return self._generate_template(query, results)

    def _generate_template(self, query, results):
        if not results:
            answer = (
                "I don't have specific information on that topic in my knowledge base. "
                "For authoritative humanitarian guidance, I recommend consulting:\n"
                "- **Sphere Handbook 2018** for minimum standards\n"
                "- **ReliefWeb** (reliefweb.int) for current crisis information\n"
                "- **HDX** (data.humdata.org) for humanitarian data"
            )
            return answer, []

        answer = "Based on the humanitarian knowledge base:\n\n"
        for i, r in enumerate(results[:3], 1):
            text = r["text"]
            if len(text) > 500:
                text = text[:500] + "..."
            answer += f"**{r['section']}** ({r['source']})\n{text}\n\n"

        if len(results) > 3:
            answer += f"*{len(results) - 3} additional relevant sources found.*\n"

        return answer, results


# ---------------------------------------------------------------------------
# Safety Auditor
# ---------------------------------------------------------------------------

def load_scenarios():
    if not SCENARIOS_PATH.exists():
        return []
    with open(SCENARIOS_PATH) as f:
        return json.load(f)


def evaluate_scenario(scenario, rag):
    query = scenario.get("prompt", scenario.get("input", ""))
    results = rag.search(query, top_k=3)

    expected = scenario.get("expected_facts", scenario.get("expected", []))
    if isinstance(expected, str):
        expected = [expected]

    matched = 0
    for fact in expected:
        fact_lower = fact.lower()
        for r in results:
            if any(word in r["text"].lower() for word in fact_lower.split() if len(word) > 3):
                matched += 1
                break

    coverage = matched / max(len(expected), 1)
    return {
        "scenario": scenario.get("name", scenario.get("id", "unknown")),
        "category": scenario.get("category", "general"),
        "query": query[:100],
        "retrieved": len(results),
        "expected_facts": len(expected),
        "matched_facts": matched,
        "coverage": f"{coverage:.0%}",
        "status": "PASS" if coverage >= 0.5 else "PARTIAL" if coverage > 0 else "FAIL",
    }


# ---------------------------------------------------------------------------
# Gradio UI
# ---------------------------------------------------------------------------

def build_ui():
    rag = RAGEngine()
    generator = ResponseGenerator(rag)
    scenarios = load_scenarios()

    with gr.Blocks(
        title="HAI — Humanitarian AI Assistant",
        theme=gr.themes.Soft(),
    ) as app:
        gr.Markdown(
            "# HAI — Humanitarian AI Assistant\n"
            "Citation-grounded AI for humanitarian standards, crisis data, and aid coordination.\n"
            f"Knowledge base: **{len(rag.chunks)} chunks** indexed | "
            f"Model: **{'Ollama (' + generator.ollama_model + ')' if generator.ollama_available else 'Template-based (no Ollama)'}**"
        )

        with gr.Tabs():
            # --- Chat Tab ---
            with gr.Tab("Chat"):
                chatbot = gr.Chatbot(
                    label="HAI Chat",
                    height=500,
                    type="messages",
                )
                msg = gr.Textbox(
                    placeholder="Ask about humanitarian standards, crisis response, or aid coordination...",
                    label="Your question",
                    lines=2,
                )
                with gr.Row():
                    submit_btn = gr.Button("Send", variant="primary")
                    clear_btn = gr.Button("Clear")

                gr.Examples(
                    examples=[
                        "What is the minimum water supply per person per day?",
                        "How many people are forcibly displaced worldwide?",
                        "What is the IPC food security classification?",
                        "What are the Sphere shelter standards?",
                        "What is the cluster coordination system?",
                        "What happened during the Pakistan floods 2022?",
                        "How should cholera outbreaks be managed?",
                        "What is the Core Humanitarian Standard?",
                    ],
                    inputs=msg,
                )

                def respond(message, chat_history):
                    if not message.strip():
                        return "", chat_history

                    history_pairs = []
                    for i in range(0, len(chat_history) - 1, 2):
                        if (chat_history[i]["role"] == "user" and
                            i + 1 < len(chat_history) and
                            chat_history[i + 1]["role"] == "assistant"):
                            history_pairs.append(
                                (chat_history[i]["content"], chat_history[i + 1]["content"])
                            )

                    answer, sources = generator.generate(message, history_pairs)

                    chat_history = chat_history + [
                        {"role": "user", "content": message},
                        {"role": "assistant", "content": answer},
                    ]
                    return "", chat_history

                msg.submit(respond, [msg, chatbot], [msg, chatbot])
                submit_btn.click(respond, [msg, chatbot], [msg, chatbot])
                clear_btn.click(lambda: ([], ""), None, [chatbot, msg])

            # --- Auditor Tab ---
            with gr.Tab("Safety Auditor"):
                gr.Markdown(
                    "## Petri Safety Evaluation\n"
                    f"**{len(scenarios)} test scenarios** from the humanitarian safety evaluation suite.\n"
                    "Evaluates whether the RAG retrieval covers expected facts for each scenario."
                )

                run_audit_btn = gr.Button("Run Evaluation", variant="primary")
                audit_output = gr.Dataframe(
                    headers=["Scenario", "Category", "Retrieved", "Expected", "Matched", "Coverage", "Status"],
                    label="Evaluation Results",
                )

                def run_audit():
                    if not scenarios:
                        return [["No scenarios loaded", "", "", "", "", "", ""]]
                    results = []
                    for s in scenarios:
                        r = evaluate_scenario(s, rag)
                        results.append([
                            r["scenario"],
                            r["category"],
                            r["retrieved"],
                            r["expected_facts"],
                            r["matched_facts"],
                            r["coverage"],
                            r["status"],
                        ])
                    return results

                run_audit_btn.click(run_audit, None, audit_output)

            # --- Stats Tab ---
            with gr.Tab("Knowledge Base"):
                gr.Markdown("## Knowledge Base Statistics")

                if KB_PATH.exists():
                    with open(KB_PATH) as f:
                        kb_data = json.load(f)

                    stats_rows = []
                    for key, val in kb_data.items():
                        if isinstance(val, list):
                            stats_rows.append([key, str(len(val)), "list"])
                        elif isinstance(val, dict):
                            if all(isinstance(v, str) for v in val.values()):
                                stats_rows.append([key, str(len(val)), "definitions"])
                            else:
                                stats_rows.append([key, str(len(val)), "sections"])

                    gr.Dataframe(
                        value=stats_rows,
                        headers=["Section", "Count", "Type"],
                        label="Knowledge Base Contents",
                    )

                    gr.Markdown(f"**Total indexed chunks:** {len(rag.chunks)}")
                    gr.Markdown(f"**File size:** {KB_PATH.stat().st_size:,} bytes")
                else:
                    gr.Markdown("Knowledge base not found. Run the knowledge base generator first.")

                gr.Markdown(
                    "\n---\n"
                    "### Key Standards Quick Reference\n"
                    "| Standard | Minimum | Source |\n"
                    "|---|---|---|\n"
                    "| Water supply | 15 litres/person/day | Sphere 2018, WASH 1 |\n"
                    "| Covered living space | 3.5 m²/person | Sphere 2018, Shelter |\n"
                    "| Daily calories | 2,100 kcal/person/day | Sphere 2018, Food Security 1 |\n"
                    "| Toilets | 1 per 20 people max | Sphere 2018, WASH 3 |\n"
                    "| Health facility | 1 per 10,000 population | Sphere 2018, Health 1 |\n"
                    "| Camp area | 45 m²/person (planned) | Sphere 2018 |\n"
                    "| Soap | 250g/person/month | Sphere 2018, WASH 4 |\n"
                    "| CMR emergency | 2x baseline | Sphere 2018 |\n"
                    "| GAM emergency | 15%+ | Sphere/WHO |\n"
                    "| Measles vaccination | >95% coverage | Sphere 2018, Health 2 |\n"
                )

    return app


if __name__ == "__main__":
    app = build_ui()
    app.launch(
        server_name="127.0.0.1",
        server_port=7860,
        share=False,
    )
