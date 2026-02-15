#!/bin/bash

# Test curl command for /api/ingest endpoint
# This creates a minimal bug report to test the Cloudflare deployment

echo "Testing Cloudflare /api/ingest endpoint..."
echo ""

curl -X POST https://quickbugs-dashboard.a-abdulkadir-ali.workers.dev/api/ingest \
  -F "project_key=qb_wvw73zh91j5a" \
  -F "title=[CURL TEST] Test report" \
  -F "description=Testing from curl command" \
  -F "provider=cloud" \
  -F "capture_mode=screenshot" \
  -F "user_agent=curl-test" \
  -F "browser_name=curl" \
  -F "os_name=CLI" \
  -F "device_type=server" \
  -F "environment=test" \
  -F "screenshot=@/dev/null;filename=test.png;type=image/png" \
  -v

echo ""
echo "Test complete!"
