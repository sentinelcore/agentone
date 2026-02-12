#!/bin/bash

# DeCharge Scout - NPM Publishing Helper
# Makes it easy to publish to npm registry

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}${BOLD}📦 DeCharge Scout - NPM Publishing Helper${NC}\n"

# Check if logged in to npm
echo -e "${BLUE}ℹ${NC}  Checking npm authentication..."
if ! npm whoami &> /dev/null; then
    echo -e "${YELLOW}⚠${NC}  Not logged in to npm"
    echo -e "${BLUE}ℹ${NC}  Running 'npm login'..."
    npm login
else
    echo -e "${GREEN}✓${NC} Logged in as: $(npm whoami)"
fi

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "\n${BLUE}ℹ${NC}  Current version: ${CURRENT_VERSION}"

# Ask for version bump
echo -e "\n${CYAN}Select version bump:${NC}"
echo "  1. patch (1.0.0 -> 1.0.1) - Bug fixes"
echo "  2. minor (1.0.0 -> 1.1.0) - New features"
echo "  3. major (1.0.0 -> 2.0.0) - Breaking changes"
echo "  4. Skip version bump (publish current version)"
echo ""
read -p "Choice (1-4): " VERSION_CHOICE

case $VERSION_CHOICE in
    1)
        npm version patch --no-git-tag-version
        ;;
    2)
        npm version minor --no-git-tag-version
        ;;
    3)
        npm version major --no-git-tag-version
        ;;
    4)
        echo -e "${BLUE}ℹ${NC}  Keeping current version"
        ;;
    *)
        echo -e "${RED}✗${NC} Invalid choice"
        exit 1
        ;;
esac

NEW_VERSION=$(node -p "require('./package.json').version")
echo -e "${GREEN}✓${NC} Version: ${NEW_VERSION}"

# Check package name availability
PACKAGE_NAME=$(node -p "require('./package.json').name")
echo -e "\n${BLUE}ℹ${NC}  Checking if package name '${PACKAGE_NAME}' is available..."

if npm view "$PACKAGE_NAME" &> /dev/null; then
    echo -e "${YELLOW}⚠${NC}  Package '${PACKAGE_NAME}' already exists on npm"
    EXISTING_VERSION=$(npm view "$PACKAGE_NAME" version)
    echo -e "${BLUE}ℹ${NC}  Latest version on npm: ${EXISTING_VERSION}"

    if [ "$NEW_VERSION" = "$EXISTING_VERSION" ]; then
        echo -e "${RED}✗${NC} Cannot publish same version twice!"
        echo -e "${YELLOW}⚠${NC}  Run 'npm version patch/minor/major' to bump version"
        exit 1
    fi
else
    echo -e "${GREEN}✓${NC} Package name is available!"
fi

# Dry run
echo -e "\n${BLUE}ℹ${NC}  Running publish dry-run..."
npm publish --dry-run

echo -e "\n${YELLOW}⚠${NC}  Files that will be published (shown above)"
read -p "Continue with publish? (y/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⚠${NC}  Publish cancelled"
    exit 0
fi

# Publish
echo -e "\n${BLUE}ℹ${NC}  Publishing to npm..."
npm publish --access public

echo -e "\n${GREEN}${BOLD}✅ Successfully published!${NC}\n"

# Show installation commands
echo -e "${CYAN}Users can now install with:${NC}"
echo -e "  ${GREEN}npm install -g ${PACKAGE_NAME}${NC}"
echo -e "  ${GREEN}npx ${PACKAGE_NAME}${NC}"
echo ""

# Show npm page
NPM_URL="https://www.npmjs.com/package/${PACKAGE_NAME}"
echo -e "${CYAN}View on npm:${NC}"
echo -e "  ${NPM_URL}"
echo ""

# Ask about git tag
read -p "Create git tag for v${NEW_VERSION}? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    git tag -a "v${NEW_VERSION}" -m "Release v${NEW_VERSION}"
    echo -e "${GREEN}✓${NC} Created tag v${NEW_VERSION}"

    read -p "Push tag to remote? (y/N): " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git push origin "v${NEW_VERSION}"
        echo -e "${GREEN}✓${NC} Pushed tag to remote"
    fi
fi

echo -e "\n${GREEN}${BOLD}🎉 All done!${NC}\n"
