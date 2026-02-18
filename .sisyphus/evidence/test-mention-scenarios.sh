#!/bin/bash

# Test script for process-mention edge function
# Tests verified and unverified mention scenarios locally

set -e

# Configuration
LOCAL_ENDPOINT="http://127.0.0.1:54321/functions/v1/process-mention"
SUPABASE_KEY="sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== RailMint Process-Mention Local Test Script ===${NC}\n"

# Test 1: Verified creator - publish command
echo -e "${GREEN}Test 1: Verified creator - publish command${NC}"
echo "Expected: Post created, AI reply sent"
echo ""

curl -X POST "$LOCAL_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "apikey: $SUPABASE_KEY" \
  -d '{
    "mention_id": "test-verified-publish-001",
    "text": "@railmint publish: Exploring DeFi yield farming strategies on opBNB. Layer 2 scaling makes transaction costs negligible while maintaining security guarantees from the base layer.",
    "author_handle": "@verified_creator",
    "reply_with_ai": true,
    "reply_via_twitterapi": false,
    "reply_to_id": "1234567890123456789"
  }' | jq '.'

echo -e "\n${GREEN}---${NC}\n"

# Test 2: Unverified user - publish command
echo -e "${YELLOW}Test 2: Unverified user - publish command${NC}"
echo "Expected: Verification CTA reply sent, no post created"
echo ""

curl -X POST "$LOCAL_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "apikey: $SUPABASE_KEY" \
  -d '{
    "mention_id": "test-unverified-publish-002",
    "text": "@railmint publish: This is a great project!",
    "author_handle": "@unverified_user",
    "reply_with_ai": true,
    "reply_via_twitterapi": false,
    "reply_to_id": "1234567890123456790"
  }' | jq '.'

echo -e "\n${YELLOW}---${NC}\n"

# Test 3: Verified creator - ask command
echo -e "${GREEN}Test 3: Verified creator - ask command${NC}"
echo "Expected: AI-generated response about creator content"
echo ""

curl -X POST "$LOCAL_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "apikey: $SUPABASE_KEY" \
  -d '{
    "mention_id": "test-verified-ask-003",
    "text": "@railmint ask: What are the latest updates from @verified_creator?",
    "author_handle": "@community_member",
    "reply_with_ai": true,
    "reply_via_twitterapi": false,
    "reply_to_id": "1234567890123456791"
  }' | jq '.'

echo -e "\n${GREEN}---${NC}\n"

# Test 4: Unverified user - ask command
echo -e "${YELLOW}Test 4: Unverified user - ask command${NC}"
echo "Expected: AI reply with general content info (no verification needed for asks)"
echo ""

curl -X POST "$LOCAL_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "apikey: $SUPABASE_KEY" \
  -d '{
    "mention_id": "test-unverified-ask-004",
    "text": "@railmint ask: What is RailMint about?",
    "author_handle": "@curious_user",
    "reply_with_ai": true,
    "reply_via_twitterapi": false,
    "reply_to_id": "1234567890123456792"
  }' | jq '.'

echo -e "\n${YELLOW}---${NC}\n"

# Test 5: Donate command (requires verification)
echo -e "${GREEN}Test 5: Verified user - donate command${NC}"
echo "Expected: Donation processed, reward pool updated"
echo ""

curl -X POST "$LOCAL_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "apikey: $SUPABASE_KEY" \
  -d '{
    "mention_id": "test-verified-donate-005",
    "text": "@railmint donate 0.1 bnb to @verified_creator",
    "author_handle": "@donor_verified",
    "author_wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    "reply_with_ai": true,
    "reply_via_twitterapi": false,
    "reply_to_id": "1234567890123456793"
  }' | jq '.'

echo -e "\n${GREEN}---${NC}\n"

# Test 6: Deferred processing (webhook simulation)
echo -e "${YELLOW}Test 6: Deferred processing - webhook simulation${NC}"
echo "Expected: Mention queued with status 'received'"
echo ""

curl -X POST "$LOCAL_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "apikey: $SUPABASE_KEY" \
  -d '{
    "mention_id": "test-deferred-006",
    "text": "@railmint publish: Testing deferred processing",
    "author_handle": "@test_user",
    "defer_processing": true
  }' | jq '.'

echo -e "\n${YELLOW}---${NC}\n"

echo -e "${GREEN}=== Test script completed ===${NC}"
echo -e "\nNote: These tests use local Supabase and bypass webhook signature verification."
echo -e "To test with webhook signatures, use the X webhook endpoint with proper headers."
echo -e "\nLocal Supabase Dashboard: http://127.0.0.1:54323"
