#!/bin/bash
#
# Deploy StackSuite Sales Manager to WordPress.org SVN
#
# Usage: bash deploy-to-svn.sh
#
# Requires: svn, rsync
# Run from the plugin/ directory.

set -e

# Configuration
PLUGIN_SLUG="stacksuite-sales-manager-for-woocommerce"
SVN_URL="https://plugins.svn.wordpress.org/${PLUGIN_SLUG}"
SVN_DIR="/tmp/svn-${PLUGIN_SLUG}"
BUILD_DIR="./build/${PLUGIN_SLUG}"
ASSETS_DIR="./.wordpress-org"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Extract version from main plugin file
PLUGIN_VERSION=$(grep -m1 "Version:" stacksuite-sales-manager-for-woocommerce.php | sed 's/.*Version: *//' | tr -d ' ')

if [ -z "${PLUGIN_VERSION}" ]; then
    echo -e "${RED}ERROR: Could not detect plugin version.${NC}"
    exit 1
fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  SVN Deploy: ${PLUGIN_SLUG}${NC}"
echo -e "${GREEN}  Version:    ${PLUGIN_VERSION}${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check for required tools
for cmd in svn rsync; do
    if ! command -v "$cmd" &> /dev/null; then
        echo -e "${RED}ERROR: '$cmd' is required but not installed.${NC}"
        exit 1
    fi
done

# Prompt for SVN credentials if not in environment
if [ -z "${SVN_USERNAME}" ]; then
    read -rp "WordPress.org SVN username: " SVN_USERNAME
fi
if [ -z "${SVN_PASSWORD}" ]; then
    read -rsp "WordPress.org SVN password: " SVN_PASSWORD
    echo ""
fi

# Step 1: Build
echo -e "${YELLOW}[1/7]${NC} Running build script..."
bash build.sh

if [ ! -d "${BUILD_DIR}" ]; then
    echo -e "${RED}ERROR: Build directory not found at ${BUILD_DIR}${NC}"
    exit 1
fi

# Step 2: SVN checkout (shallow — trunk + assets only, skip full tag history)
echo -e "${YELLOW}[2/7]${NC} Checking out SVN repository..."
rm -rf "${SVN_DIR}"
svn checkout "${SVN_URL}" "${SVN_DIR}" \
    --depth immediates \
    --username "${SVN_USERNAME}" \
    --password "${SVN_PASSWORD}" \
    --non-interactive \
    --no-auth-cache

# Update trunk and assets to full depth
svn update "${SVN_DIR}/trunk" --set-depth infinity --non-interactive
svn update "${SVN_DIR}/assets" --set-depth infinity --non-interactive

# Step 3: Sync build output to trunk
echo -e "${YELLOW}[3/7]${NC} Syncing build to SVN trunk..."
rsync -rc --delete "${BUILD_DIR}/" "${SVN_DIR}/trunk/"

# Step 4: Sync WordPress.org assets
echo -e "${YELLOW}[4/7]${NC} Syncing assets..."
if [ -d "${ASSETS_DIR}" ]; then
    # Only sync actual image files, skip .gitkeep
    rsync -rc --delete \
        --include='*.png' \
        --include='*.jpg' \
        --include='*.jpeg' \
        --include='*.gif' \
        --include='*.svg' \
        --exclude='*' \
        "${ASSETS_DIR}/" "${SVN_DIR}/assets/"
    echo "  Assets synced from ${ASSETS_DIR}"
else
    echo -e "  ${YELLOW}No assets directory found, skipping.${NC}"
fi

# Step 5: Handle SVN add/delete for changed files
echo -e "${YELLOW}[5/7]${NC} Updating SVN file tracking..."

# Add new files
svn status "${SVN_DIR}" | grep '^\?' | awk '{print $2}' | while IFS= read -r file; do
    svn add --parents "${file}"
done

# Remove deleted files
svn status "${SVN_DIR}" | grep '^\!' | awk '{print $2}' | while IFS= read -r file; do
    svn delete "${file}"
done

# Set MIME types on image assets
for img in "${SVN_DIR}/assets/"*.png; do
    [ -f "$img" ] && svn propset svn:mime-type image/png "$img" 2>/dev/null || true
done
for img in "${SVN_DIR}/assets/"*.jpg "${SVN_DIR}/assets/"*.jpeg; do
    [ -f "$img" ] && svn propset svn:mime-type image/jpeg "$img" 2>/dev/null || true
done
for img in "${SVN_DIR}/assets/"*.gif; do
    [ -f "$img" ] && svn propset svn:mime-type image/gif "$img" 2>/dev/null || true
done
for img in "${SVN_DIR}/assets/"*.svg; do
    [ -f "$img" ] && svn propset svn:mime-type image/svg+xml "$img" 2>/dev/null || true
done

# Step 6: Create SVN tag
echo -e "${YELLOW}[6/7]${NC} Creating SVN tag ${PLUGIN_VERSION}..."

if svn list "${SVN_URL}/tags/${PLUGIN_VERSION}/" --non-interactive &>/dev/null; then
    echo -e "  ${YELLOW}Tag ${PLUGIN_VERSION} already exists. Updating...${NC}"
    svn update "${SVN_DIR}/tags/${PLUGIN_VERSION}" --set-depth infinity --non-interactive
    rsync -rc --delete "${SVN_DIR}/trunk/" "${SVN_DIR}/tags/${PLUGIN_VERSION}/"
else
    svn copy "${SVN_DIR}/trunk" "${SVN_DIR}/tags/${PLUGIN_VERSION}"
fi

# Handle add/delete in tags too
svn status "${SVN_DIR}/tags/${PLUGIN_VERSION}" | grep '^\?' | awk '{print $2}' | while IFS= read -r file; do
    svn add --parents "${file}"
done
svn status "${SVN_DIR}/tags/${PLUGIN_VERSION}" | grep '^\!' | awk '{print $2}' | while IFS= read -r file; do
    svn delete "${file}"
done

# Step 7: Show summary and confirm
echo -e "${YELLOW}[7/7]${NC} Review and commit..."
echo ""
echo -e "${GREEN}Changes summary:${NC}"
svn status "${SVN_DIR}" | head -50
CHANGE_COUNT=$(svn status "${SVN_DIR}" | wc -l)
if [ "${CHANGE_COUNT}" -gt 50 ]; then
    echo "  ... and $((CHANGE_COUNT - 50)) more changes"
fi
echo ""
echo -e "Total changes: ${CHANGE_COUNT}"
echo ""

read -rp "Commit these changes to WordPress.org SVN? (y/N): " CONFIRM
if [ "${CONFIRM}" != "y" ] && [ "${CONFIRM}" != "Y" ]; then
    echo -e "${YELLOW}Aborted. SVN working copy preserved at: ${SVN_DIR}${NC}"
    exit 0
fi

# Commit
echo "Committing..."
svn commit "${SVN_DIR}" \
    -m "Release ${PLUGIN_VERSION}" \
    --username "${SVN_USERNAME}" \
    --password "${SVN_PASSWORD}" \
    --non-interactive \
    --no-auth-cache

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployed ${PLUGIN_SLUG} v${PLUGIN_VERSION}${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "  Trunk:  ${SVN_URL}/trunk/"
echo "  Tag:    ${SVN_URL}/tags/${PLUGIN_VERSION}/"
echo "  Plugin: https://wordpress.org/plugins/${PLUGIN_SLUG}/"
echo ""

# Cleanup
rm -rf "${SVN_DIR}"
echo "SVN working copy cleaned up."
