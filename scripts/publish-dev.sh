#!/bin/bash
set -e

# Script to publish development versions of packages
# Usage: ./scripts/publish-dev.sh

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📦 Publishing development packages...${NC}"

# Extract branch name
if [ -n "$GITHUB_REF" ]; then
  BRANCH_NAME="${GITHUB_REF#refs/heads/}"
else
  BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)
fi

# Sanitize branch name for npm version (replace / with -)
SAFE_BRANCH_NAME=$(echo "$BRANCH_NAME" | sed 's/\//-/g')

# Get timestamp
TIMESTAMP=$(date +%Y%m%d)

# Build number from GitHub or git commit
if [ -n "$GITHUB_RUN_NUMBER" ]; then
  BUILD_NUMBER="$GITHUB_RUN_NUMBER"
else
  BUILD_NUMBER=$(git rev-parse --short HEAD)
fi

echo -e "${BLUE}Branch:${NC} $SAFE_BRANCH_NAME"
echo -e "${BLUE}Timestamp:${NC} $TIMESTAMP"
echo -e "${BLUE}Build:${NC} $BUILD_NUMBER"
echo ""

# Base branch to compare with for changes detection
BASE_BRANCH="main"

echo -e "${BLUE}Comparing with:${NC} origin/$BASE_BRANCH"
echo ""

# Function to check if package has changes
has_changes() {
  local package_dir="${1%/}"
  
  # Check if there are any changes in this package directory
  if git diff --quiet "origin/$BASE_BRANCH"...HEAD -- "$package_dir"; then
    return 1  # No changes
  else
    return 0  # Has changes
  fi
}

# Function to update package version
update_package_version() {
  local package_dir="${1%/}"  # Remove trailing slash
  local package_json="${package_dir}/package.json"
  
  if [ -f "$package_json" ]; then
    PACKAGE_NAME=$(node -p "require('${package_json}').name")
    CURRENT_VERSION=$(node -p "require('${package_json}').version")
    DEV_VERSION="${CURRENT_VERSION}-dev.${SAFE_BRANCH_NAME}.${TIMESTAMP}.${BUILD_NUMBER}"
    
    echo -e "${GREEN}Updating ${PACKAGE_NAME}:${NC} ${CURRENT_VERSION} → ${DEV_VERSION}"
    
    # Update version in package.json without git tag
    cd "$package_dir"
    npm version "$DEV_VERSION" --no-git-tag-version --allow-same-version
    cd - > /dev/null
  fi
}

# Update only packages with changes
echo -e "${BLUE}Detecting changed packages...${NC}"
CHANGED_PACKAGES=()
for package_dir in packages/*/; do
  package_dir="${package_dir%/}"
  if has_changes "$package_dir"; then
    PACKAGE_NAME=$(node -p "require('${package_dir}/package.json').name" 2>/dev/null || echo "unknown")
    echo -e "  ${GREEN}✓${NC} $PACKAGE_NAME (has changes)"
    CHANGED_PACKAGES+=("$package_dir")
  else
    PACKAGE_NAME=$(node -p "require('${package_dir}/package.json').name" 2>/dev/null || echo "unknown")
    echo -e "  ${BLUE}○${NC} $PACKAGE_NAME (no changes, skipping)"
  fi
done

echo ""

if [ ${#CHANGED_PACKAGES[@]} -eq 0 ]; then
  echo -e "${BLUE}No packages have changes. Nothing to publish.${NC}"
  exit 0
fi

echo -e "${BLUE}Updating versions for ${#CHANGED_PACKAGES[@]} package(s)...${NC}"
for package_dir in "${CHANGED_PACKAGES[@]}"; do
  update_package_version "$package_dir"
done

echo ""
echo -e "${BLUE}Publishing ${#CHANGED_PACKAGES[@]} package(s) with 'dev' tag...${NC}"

# Build filter for only changed packages
PUBLISH_FILTERS=""
for package_dir in "${CHANGED_PACKAGES[@]}"; do
  PACKAGE_NAME=$(node -p "require('${package_dir}/package.json').name")
  PUBLISH_FILTERS="$PUBLISH_FILTERS --filter '$PACKAGE_NAME'"
done

# Publish only changed packages with dev tag
if [ -n "$PUBLISH_FILTERS" ]; then
  eval "pnpm -r $PUBLISH_FILTERS --no-bail publish --tag dev --access public --no-git-checks"
fi

echo ""
echo -e "${GREEN}✅ Dev packages published successfully!${NC}"
echo ""
echo -e "${BLUE}Install with:${NC}"
for package_dir in "${CHANGED_PACKAGES[@]}"; do
  PACKAGE_NAME=$(node -p "require('${package_dir}/package.json').name")
  echo "  pnpm add ${PACKAGE_NAME}@dev"
done

# Create summary file for GitHub Actions (if running in CI)
if [ -n "$GITHUB_OUTPUT" ]; then
  echo "published_count=${#CHANGED_PACKAGES[@]}" >> "$GITHUB_OUTPUT"
  
  # Write package names to a temp file
  PACKAGES_LIST=""
  for package_dir in "${CHANGED_PACKAGES[@]}"; do
    PACKAGE_NAME=$(node -p "require('${package_dir}/package.json').name")
    if [ -z "$PACKAGES_LIST" ]; then
      PACKAGES_LIST="$PACKAGE_NAME"
    else
      PACKAGES_LIST="$PACKAGES_LIST,$PACKAGE_NAME"
    fi
  done
  echo "published_packages=$PACKAGES_LIST" >> "$GITHUB_OUTPUT"
fi
