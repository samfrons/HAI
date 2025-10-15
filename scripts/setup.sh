#!/bin/bash
#
# HAI (Humanitarian AI) - Setup Script
#
# This script sets up the complete development environment for HAI including:
# - Ollama local LLM runtime
# - Python dependencies
# - Petri auditing framework
# - Environment configuration
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}HAI (Humanitarian AI) Setup${NC}"
echo -e "${GREEN}Cost-Effective Humanitarian LLM POC${NC}"
echo -e "${GREEN}========================================${NC}\n"

# Check if running on macOS or Linux
OS="$(uname -s)"
echo -e "${YELLOW}Detected OS: $OS${NC}\n"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# ============================================================================
# 1. Install Ollama
# ============================================================================

echo -e "${GREEN}[1/6] Installing Ollama...${NC}"

if command_exists ollama; then
    echo -e "${YELLOW}Ollama already installed. Skipping.${NC}"
    ollama --version
else
    echo "Installing Ollama..."
    case "$OS" in
        Darwin*)
            # macOS
            curl -fsSL https://ollama.com/install.sh | sh
            ;;
        Linux*)
            # Linux
            curl -fsSL https://ollama.com/install.sh | sh
            ;;
        *)
            echo -e "${RED}Unsupported OS. Please install Ollama manually from https://ollama.com${NC}"
            exit 1
            ;;
    esac
    echo -e "${GREEN}Ollama installed successfully!${NC}"
fi

# ============================================================================
# 2. Pull Llama 3.3 8B Model
# ============================================================================

echo -e "\n${GREEN}[2/6] Pulling Llama 3.3 8B model...${NC}"

if ollama list | grep -q "llama3.3:8b"; then
    echo -e "${YELLOW}Llama 3.3 8B already downloaded. Skipping.${NC}"
else
    echo "Downloading Llama 3.3 8B (~4.7GB)..."
    ollama pull llama3.3:8b
    echo -e "${GREEN}Llama 3.3 8B downloaded successfully!${NC}"
fi

# ============================================================================
# 3. Check Python Installation
# ============================================================================

echo -e "\n${GREEN}[3/6] Checking Python installation...${NC}"

if command_exists python3; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    echo -e "Python version: $PYTHON_VERSION"

    # Check if Python version is 3.10 or higher
    PYTHON_MAJOR=$(echo "$PYTHON_VERSION" | cut -d'.' -f1)
    PYTHON_MINOR=$(echo "$PYTHON_VERSION" | cut -d'.' -f2)

    if [ "$PYTHON_MAJOR" -ge 3 ] && [ "$PYTHON_MINOR" -ge 10 ]; then
        echo -e "${GREEN}Python 3.10+ detected. Good to go!${NC}"
    else
        echo -e "${RED}Python 3.10+ required. Please upgrade Python.${NC}"
        exit 1
    fi
else
    echo -e "${RED}Python 3 not found. Please install Python 3.10+${NC}"
    exit 1
fi

# ============================================================================
# 4. Create Python Virtual Environment
# ============================================================================

echo -e "\n${GREEN}[4/6] Setting up Python virtual environment...${NC}"

if [ -d "venv" ]; then
    echo -e "${YELLOW}Virtual environment already exists. Skipping creation.${NC}"
else
    python3 -m venv venv
    echo -e "${GREEN}Virtual environment created!${NC}"
fi

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# ============================================================================
# 5. Install Python Dependencies
# ============================================================================

echo -e "\n${GREEN}[5/6] Installing Python dependencies...${NC}"

echo "Installing core dependencies..."
pip install -r config/requirements.txt

echo -e "\nInstalling Petri auditing framework..."
pip install git+https://github.com/safety-research/petri.git

echo -e "${GREEN}All Python dependencies installed!${NC}"

# ============================================================================
# 6. Setup Environment Configuration
# ============================================================================

echo -e "\n${GREEN}[6/6] Setting up environment configuration...${NC}"

if [ -f "config/.env" ]; then
    echo -e "${YELLOW}.env file already exists. Skipping.${NC}"
else
    cp config/.env.example config/.env
    echo -e "${GREEN}Created config/.env from template${NC}"
    echo -e "${YELLOW}⚠️  Please edit config/.env and add your API keys:${NC}"
    echo -e "   - ANTHROPIC_API_KEY (for Claude Haiku/Sonnet)"
    echo -e "   - OPENROUTER_API_KEY (for free tier testing)"
fi

# ============================================================================
# Completion
# ============================================================================

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Setup Complete! ✓${NC}"
echo -e "${GREEN}========================================${NC}\n"

echo -e "Next steps:"
echo -e "1. Activate virtual environment: ${YELLOW}source venv/bin/activate${NC}"
echo -e "2. Edit config/.env with your API keys"
echo -e "3. Run knowledge extraction: ${YELLOW}python3 scripts/extract_humanitarian_knowledge.py${NC}"
echo -e "4. Start Ollama server: ${YELLOW}ollama serve${NC}"
echo -e "5. Test local model: ${YELLOW}ollama run llama3.3:8b${NC}\n"

echo -e "${YELLOW}Budget Tracking:${NC}"
echo -e "- Local operations (Ollama): $0"
echo -e "- OpenRouter free tier: $0"
echo -e "- Petri auditing (Haiku): ~$50-100"
echo -e "- Premium validation (Sonnet): ~$50-100"
echo -e "- Total estimated cost: ${GREEN}$100-200${NC}\n"

echo -e "${GREEN}Happy building! 🚀${NC}"
