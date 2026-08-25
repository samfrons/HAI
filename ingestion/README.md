# Ingestion

Pipeline for turning primary humanitarian references into the corpus the
`search_standards` tool queries: source documents (Sphere Handbook, Core
Humanitarian Standard, IASC guidance, etc.) go into `ingestion/corpus/`,
get split with contextual chunking (chunks retain surrounding document
context rather than being split blind), are embedded with Voyage AI, and
are written into Supabase pgvector for hybrid (vector + keyword) search.
Ingestion scripts to come.
