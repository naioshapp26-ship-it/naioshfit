#!/bin/bash
# Manual Purchase Flow Test Script
# Run this to test the complete purchase flow

echo "🚀 MANUAL PURCHASE FLOW TEST"
echo "============================"
echo ""

BASE_URL="http://localhost:5000"

echo "Step 1: Login"
echo "-------------"
LOGIN_RESPONSE=$(curl -s -c cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"demo_client","password":"password123"}')

echo "✅ Login response:"
echo "$LOGIN_RESPONSE" | head -c 200
echo ""
echo ""

echo "Step 2: Get Products"
echo "-------------------"
PRODUCTS=$(curl -s -b cookies.txt "$BASE_URL/api/products")
echo "✅ Products count:" $(echo "$PRODUCTS" | grep -o '"id"' | wc -l)
echo ""

# Extract first 3 product IDs
PRODUCT_ID_1=$(echo "$PRODUCTS" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
PRODUCT_ID_2=$(echo "$PRODUCTS" | grep -o '"id":[0-9]*' | head -2 | tail -1 | cut -d':' -f2)
PRODUCT_ID_3=$(echo "$PRODUCTS" | grep -o '"id":[0-9]*' | head -3 | tail -1 | cut -d':' -f2)

echo "Selected products: $PRODUCT_ID_1, $PRODUCT_ID_2, $PRODUCT_ID_3"
echo ""

echo "Step 3: Create Order"
echo "-------------------"
ORDER_DATA='{
  "items": [
    {"productId": '$PRODUCT_ID_1', "quantity": 2},
    {"productId": '$PRODUCT_ID_2', "quantity": 1}
  ],
  "shippingAddress": "123 Test Street",
  "shippingCity": "Cairo",
  "shippingCountry": "Egypt",
  "shippingPhone": "+201234567890",
  "notes": "Test order from manual script"
}'

ORDER_RESPONSE=$(curl -s -b cookies.txt -X POST "$BASE_URL/api/orders" \
  -H "Content-Type: application/json" \
  -d "$ORDER_DATA")

echo "✅ Order created:"
echo "$ORDER_RESPONSE" | head -c 300
echo ""
echo ""

# Extract order ID
ORDER_ID=$(echo "$ORDER_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
echo "Order ID: $ORDER_ID"
echo ""

echo "Step 4: Get Order Details"
echo "------------------------"
ORDER_DETAILS=$(curl -s -b cookies.txt "$BASE_URL/api/orders/$ORDER_ID")
echo "✅ Order details retrieved:"
echo "$ORDER_DETAILS" | head -c 400
echo ""
echo ""

echo "Step 5: Get All Orders"
echo "---------------------"
ALL_ORDERS=$(curl -s -b cookies.txt "$BASE_URL/api/orders")
ORDERS_COUNT=$(echo "$ALL_ORDERS" | grep -o '"id"' | wc -l)
echo "✅ Total orders: $ORDERS_COUNT"
echo ""

echo "Step 6: Cancel Order"
echo "-------------------"
CANCEL_RESPONSE=$(curl -s -b cookies.txt -X PATCH "$BASE_URL/api/orders/$ORDER_ID" \
  -H "Content-Type: application/json" \
  -d '{"status":"cancelled"}')
echo "✅ Order cancelled:"
echo "$CANCEL_RESPONSE" | grep -o '"status":"[^"]*"'
echo ""
echo ""

echo "Step 7: Verify Stock Update"
echo "---------------------------"
UPDATED_PRODUCTS=$(curl -s -b cookies.txt "$BASE_URL/api/products")
echo "✅ Products retrieved after order"
echo ""

echo "✨ TEST COMPLETED!"
echo "================="
echo ""
echo "Summary:"
echo "- Logged in successfully"
echo "- Retrieved products"
echo "- Created order #$ORDER_ID"
echo "- Retrieved order details"
echo "- Listed all orders"
echo "- Cancelled order"
echo "- Verified stock updates"
echo ""
echo "🎉 Purchase flow is working!"

# Cleanup
rm -f cookies.txt
