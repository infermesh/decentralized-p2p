#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# GitHub repository details
REPO_URL="https://raw.githubusercontent.com/infermesh/decentralized-p2p/main"

# Get the installation directory
INSTALL_DIR="$HOME/.infermesh"
TEMP_DIR="/tmp/infermesh-install"

echo -e "${BLUE}Installing InferMesh...${NC}"

# Create temporary directory for downloads
rm -rf $TEMP_DIR
mkdir -p $TEMP_DIR
mkdir -p $TEMP_DIR/src

# Download source files
echo -e "${BLUE}Downloading source files...${NC}"
curl -sSL "$REPO_URL/cli.js" -o "$TEMP_DIR/cli.js"
curl -sSL "$REPO_URL/src/state-p2p-node.js" -o "$TEMP_DIR/src/state-p2p-node.js"

# Check if installation exists
if [ -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}Existing installation found at $INSTALL_DIR${NC}"
    echo -e "${YELLOW}Removing old installation...${NC}"
    rm -rf "$INSTALL_DIR"
fi

# Create directory structure
mkdir -p $INSTALL_DIR/bin
mkdir -p $INSTALL_DIR/nodes
mkdir -p $INSTALL_DIR/states

# Create package.json with ES module support
echo -e "${BLUE}Creating package.json...${NC}"
cat > "$INSTALL_DIR/package.json" << EOL
{
  "name": "infermesh",
  "version": "1.0.0",
  "type": "module",
  "description": "Decentralized State Management",
  "main": "bin/cli.js",
  "dependencies": {
    "commander": "^11.1.0",
    "chalk": "^5.3.0",
    "ws": "^8.14.2",
    "figlet": "^1.7.0"
  }
}
EOL

# Install dependencies
cd $INSTALL_DIR
echo -e "${BLUE}Installing dependencies...${NC}"
npm install > /dev/null 2>&1

# Copy source files from temporary directory
echo -e "${BLUE}Setting up files...${NC}"
cp "$TEMP_DIR/cli.js" "$INSTALL_DIR/bin/"
cp -r "$TEMP_DIR/src" "$INSTALL_DIR/bin/"

# Create mesh executable
echo -e "${BLUE}Creating mesh executable...${NC}"
cat > "$INSTALL_DIR/bin/mesh" << EOL
#!/bin/bash
node "$INSTALL_DIR/bin/cli.js" "\$@"
EOL

# Make it executable
chmod +x "$INSTALL_DIR/bin/mesh"

# Function to add to shell config if not present
add_to_shell_config() {
    local config_file="$1"
    local path_line="export PATH=\"\$PATH:$INSTALL_DIR/bin\""
    
    if [ -f "$config_file" ]; then
        # Remove old InferMesh PATH entries if they exist
        sed -i '/# InferMesh PATH/d' "$config_file" 2>/dev/null
        sed -i "\#$INSTALL_DIR/bin#d" "$config_file" 2>/dev/null
        
        # Add new entry
        echo "" >> "$config_file"
        echo "# InferMesh PATH" >> "$config_file"
        echo "$path_line" >> "$config_file"
        echo -e "${GREEN}Updated PATH in ${config_file}${NC}"
    fi
}

# Add to various shell configs
echo -e "${BLUE}Updating shell configurations...${NC}"
add_to_shell_config "$HOME/.bashrc"
add_to_shell_config "$HOME/.zshrc"
add_to_shell_config "$HOME/.profile"

# Add to current session's PATH
export PATH="$PATH:$INSTALL_DIR/bin"

# Cleanup
rm -rf $TEMP_DIR

echo -e "${GREEN}Installation complete!${NC}"
echo -e "\n${BLUE}To start using InferMesh, either:${NC}"
echo -e "1. Restart your terminal"
echo -e "2. Or run: ${BLUE}source ~/.bashrc${NC}"
echo -e "\nThen try: ${BLUE}mesh help${NC}"

# Try to source the appropriate RC file
if [ -n "$ZSH_VERSION" ]; then
    source "$HOME/.zshrc" >/dev/null 2>&1
elif [ -n "$BASH_VERSION" ]; then
    source "$HOME/.bashrc" >/dev/null 2>&1
fi

echo -e "\n${BLUE}Installation directory: ${NC}$INSTALL_DIR"
echo -e "${BLUE}Verify installation with: ${NC}mesh help"