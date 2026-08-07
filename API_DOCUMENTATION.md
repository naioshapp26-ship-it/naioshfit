# NaioshFit Platform - API Documentation

**Version:** 1.0  
**Base URL:** `https://api.naioshfit.com`  
**Date:** February 10, 2026

---

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Response Formats](#response-formats)
- [Error Handling](#error-handling)
- [API Endpoints](#api-endpoints)
  - [Authentication & Users](#authentication--users)
  - [Meals & Nutrition](#meals--nutrition)
  - [Workouts & Training](#workouts--training)
  - [Progress Tracking](#progress-tracking)
  - [E-Commerce](#e-commerce)
  - [Messaging](#messaging)
  - [Courses & Learning](#courses--learning)
  - [Supplements](#supplements)
  - [Notifications & Reminders](#notifications--reminders)
  - [Files & Reports](#files--reports)
  - [AI Assistant](#ai-assistant)
  - [Credit & Billing](#credit--billing)
  - [Payment Processing](#payment-processing)
  - [Community & Social](#community--social)
  - [Admin & Management](#admin--management)
  - [SaaS Multi-Tenancy](#saas-multi-tenancy)
  - [SEO & Settings](#seo--settings)
- [Webhooks](#webhooks)
- [SDKs & Libraries](#sdks--libraries)

---

## Overview

The NaioshFit API is a RESTful API that enables developers to interact with the NaioshFit fitness platform. The API supports:

- User authentication and profile management
- Fitness tracking (workouts, nutrition, progress)
- E-commerce operations (products, orders, payments)
- Educational courses with certificates
- AI-powered insights and recommendations
- Multi-tenant SaaS architecture
- Community features (groups, challenges, discussions)
- Credit-based billing system

### API Principles

- **REST Architecture**: Standard HTTP methods (GET, POST, PUT, PATCH, DELETE)
- **JSON Format**: All requests and responses use JSON
- **Stateful Sessions**: Cookie-based session authentication
- **Internationalization**: Supports English and Arabic
- **Multi-Tenancy**: Tenant resolution via subdomain or header

---

## Authentication

### Session-Based Authentication

The API uses session-based authentication with cookies. Most endpoints require authentication.

#### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "user@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "id": 1,
  "username": "user@example.com",
  "role": "user",
  "firstName": "John",
  "lastName": "Doe"
}
```

#### Logout

```http
POST /api/auth/logout
```

#### Get Current User

```http
GET /api/auth/me
```

**Response:**
```json
{
  "id": 1,
  "username": "user@example.com",
  "role": "user",
  "firstName": "John",
  "lastName": "Doe",
  "email": "user@example.com",
  "profilePicture": "https://...",
  "coachId": null,
  "gymId": null
}
```

### Role-Based Access Control

Roles:
- **user**: Regular trainee
- **coach**: Fitness coach with trainees
- **gym**: Gym owner managing coaches and trainees
- **admin**: Platform administrator

---

## Rate Limiting

Rate limits apply per user session:
- **Standard Users**: 100 requests per minute
- **Coaches**: 500 requests per minute
- **Admins**: Unlimited

Rate limit headers:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1644336000
```

---

## Response Formats

### Success Response

```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

### Pagination

Paginated endpoints use:
```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | OK - Request succeeded |
| 201 | Created - Resource created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Resource already exists |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

### Error Codes

- `AUTH_REQUIRED`: Authentication required
- `INVALID_CREDENTIALS`: Invalid username/password
- `PERMISSION_DENIED`: Insufficient permissions
- `RESOURCE_NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Input validation failed
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INSUFFICIENT_CREDITS`: Not enough credits

---

## API Endpoints

## Authentication & Users

### User Registration

```http
POST /api/auth/signup
Content-Type: application/json

{
  "username": "user@example.com",
  "password": "securepassword",
  "firstName": "John",
  "lastName": "Doe",
  "whatsappWithCode": "966512345678",
  "city": "Riyadh",
  "country": "Saudi Arabia",
  "gender": "male",
  "religion": "muslim",
  "age": 25,
  "height": 175,
  "weight": 75,
  "howFoundUs": "instagram",
  "role": "user"
}
```

**Response:** `201 Created`
```json
{
  "id": 1,
  "username": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "user"
}
```

### Check Username Availability

```http
GET /api/auth/username-available?username=john123
```

**Response:**
```json
{
  "available": true
}
```

### Check WhatsApp Number

```http
POST /api/check-whatsapp
Content-Type: application/json

{
  "whatsappWithCode": "966512345678"
}
```

**Response:**
```json
{
  "exists": false
}
```

### Reset Password

```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "username": "user@example.com",
  "pinNumber": "1234",
  "newPassword": "newsecurepassword"
}
```

### Get User Profile

```http
GET /api/users/:id
Authorization: Required
```

**Response:**
```json
{
  "id": 1,
  "username": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "age": 25,
  "height": 175,
  "weight": 75,
  "fitnessGoal": "weight_loss",
  "trainingLevel": "intermediate",
  "profilePicture": "https://...",
  "coachId": 5,
  "subscriptionType": "3_months",
  "subscriptionStartDate": "2026-01-01T00:00:00Z",
  "subscriptionEndDate": "2026-04-01T00:00:00Z"
}
```

### Update User Profile

```http
PATCH /api/users/:id
Authorization: Required
Content-Type: application/json

{
  "weight": 73,
  "bio": "Updated bio",
  "profilePicture": "https://..."
}
```

### Get User Progress

```http
GET /api/users/:id/progress?startDate=2026-01-01&endDate=2026-02-10
Authorization: Required
```

**Response:**
```json
{
  "progress": [
    {
      "date": "2026-02-10",
      "weight": 73.5,
      "caloriesConsumed": 2200,
      "caloriesBurned": 450
    }
  ],
  "summary": {
    "weightChange": -1.5,
    "avgCalories": 2150,
    "workoutsCompleted": 12
  }
}
```

### List Users

```http
GET /api/users?page=1&limit=20&role=user&search=john
Authorization: Required (Admin/Coach)
```

**Response:**
```json
{
  "users": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

### List Coaches

```http
GET /api/coaches
Authorization: Required
```

**Response:**
```json
[
  {
    "id": 5,
    "firstName": "Coach",
    "lastName": "Smith",
    "profilePicture": "https://...",
    "bio": "Experienced fitness coach"
  }
]
```

### Update User Subscription

```http
PATCH /api/users/:id/subscription
Authorization: Required (Admin)
Content-Type: application/json

{
  "subscriptionType": "6_months",
  "subscriptionStartDate": "2026-02-10",
  "subscriptionEndDate": "2026-08-10"
}
```

---

## Meals & Nutrition

### List Meals

```http
GET /api/meals?date=2026-02-10&type=breakfast
Authorization: Required
```

**Query Parameters:**
- `date` (optional): Filter by date (YYYY-MM-DD)
- `type` (optional): breakfast, lunch, dinner, snack
- `userId` (optional): Filter by user (coaches only)

**Response:**
```json
[
  {
    "id": 1,
    "userId": 1,
    "name": "Oatmeal with Berries",
    "type": "breakfast",
    "calories": 350,
    "proteins": 12,
    "carbs": 55,
    "fats": 8,
    "fiber": 10,
    "date": "2026-02-10T07:00:00Z",
    "foodItems": [
      {
        "name": "Oats",
        "quantity": 50,
        "unit": "g"
      }
    ]
  }
]
```

### Create Meal

```http
POST /api/meals
Authorization: Required
Content-Type: application/json

{
  "name": "Chicken Salad",
  "type": "lunch",
  "calories": 450,
  "proteins": 35,
  "carbs": 25,
  "fats": 20,
  "fiber": 8,
  "date": "2026-02-10T13:00:00Z",
  "foodItems": [
    {
      "name": "Grilled Chicken",
      "quantity": 150,
      "unit": "g",
      "calories": 250
    },
    {
      "name": "Mixed Greens",
      "quantity": 100,
      "unit": "g",
      "calories": 25
    }
  ]
}
```

**Response:** `201 Created`

### Get Meal Details

```http
GET /api/meals/:id
Authorization: Required
```

### Update Meal

```http
PATCH /api/meals/:id
Authorization: Required
Content-Type: application/json

{
  "calories": 500,
  "notes": "Added extra protein"
}
```

### Delete Meal

```http
DELETE /api/meals/:id
Authorization: Required
```

### Food Database Search

```http
GET /api/food-items?search=chicken&category=protein&language=en
Authorization: Required
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "Chicken Breast (Grilled)",
    "nameAr": "صدر دجاج مشوي",
    "calories": 165,
    "proteins": 31,
    "carbs": 0,
    "fats": 3.6,
    "fiber": 0,
    "servingSize": "100g",
    "servingSizeGrams": 100,
    "category": "protein"
  }
]
```

---

## Workouts & Training

### List Workouts

```http
GET /api/workouts?difficulty=intermediate&type=strength
Authorization: Required
```

**Query Parameters:**
- `difficulty`: beginner, intermediate, advanced
- `type`: strength, cardio, flexibility, etc.
- `coachId`: Filter by coach

**Response:**
```json
[
  {
    "id": 1,
    "name": "Full Body Workout",
    "description": "Complete full body workout for intermediate level",
    "duration": 45,
    "difficulty": "intermediate",
    "type": "strength",
    "coachId": 5,
    "exercises": [
      {
        "name": "Bench Press",
        "sets": 3,
        "reps": 10,
        "rest": 90
      }
    ]
  }
]
```

### Create Workout

```http
POST /api/workouts
Authorization: Required (Coach/Admin)
Content-Type: application/json

{
  "name": "Upper Body Strength",
  "description": "Focus on chest, back, and arms",
  "duration": 60,
  "difficulty": "intermediate",
  "type": "strength",
  "exercises": [
    {
      "name": "Bench Press",
      "sets": 4,
      "reps": 8,
      "weight": 80,
      "rest": 120,
      "notes": "Focus on form"
    }
  ]
}
```

### Get Workout Details

```http
GET /api/workouts/:id
Authorization: Required
```

### Assign Workout to User

```http
POST /api/user-workouts
Authorization: Required (Coach/Admin)
Content-Type: application/json

{
  "userId": 1,
  "workoutId": 5,
  "scheduledFor": "2026-02-11T06:00:00Z"
}
```

### List User Workouts

```http
GET /api/user-workouts?userId=1&date=2026-02-10
Authorization: Required
```

**Response:**
```json
[
  {
    "id": 1,
    "userId": 1,
    "workoutId": 5,
    "scheduledFor": "2026-02-10T06:00:00Z",
    "completed": true,
    "completedAt": "2026-02-10T07:15:00Z",
    "workout": {
      "name": "Morning Cardio",
      "duration": 30
    }
  }
]
```

### Complete Workout

```http
PATCH /api/user-workouts/:id/complete
Authorization: Required
Content-Type: application/json

{
  "completedAt": "2026-02-10T07:15:00Z",
  "notes": "Great session!"
}
```

### Log Custom Workout

```http
POST /api/custom-workouts
Authorization: Required
Content-Type: application/json

{
  "workoutName": "Evening Run",
  "workoutType": "cardio",
  "duration": 30,
  "exercises": [
    {
      "name": "Running",
      "duration": 30,
      "distance": 5,
      "pace": "6:00/km"
    }
  ]
}
```

### Quick Add Workout

```http
POST /api/quick-add-workout
Authorization: Required
Content-Type: application/json

{
  "workoutName": "Quick Cardio",
  "workoutType": "cardio",
  "duration": 20,
  "totalSets": 0,
  "completedSets": 0
}
```

### YouTube Search

```http
GET /api/youtube/search?q=home+workout&maxResults=10
Authorization: Required
```

---

## Progress Tracking

### List Progress Entries

```http
GET /api/progress?startDate=2026-02-01&endDate=2026-02-10
Authorization: Required
```

**Response:**
```json
[
  {
    "id": 1,
    "userId": 1,
    "date": "2026-02-10",
    "weight": 73.5,
    "caloriesConsumed": 2200,
    "caloriesBurned": 450,
    "steps": 8500,
    "waterGlasses": 6,
    "notes": "Feeling energetic"
  }
]
```

### Create Progress Entry

```http
POST /api/progress
Authorization: Required
Content-Type: application/json

{
  "date": "2026-02-10",
  "weight": 73.5,
  "caloriesConsumed": 2200,
  "caloriesBurned": 450,
  "steps": 8500,
  "waterGlasses": 6
}
```

### Update Progress Entry

```http
PATCH /api/progress/:id
Authorization: Required
Content-Type: application/json

{
  "weight": 73.2,
  "notes": "Updated measurement"
}
```

### Get Daily Stats

```http
GET /api/daily-stats?date=2026-02-10
Authorization: Required
```

**Response:**
```json
{
  "id": 1,
  "userId": 1,
  "date": "2026-02-10",
  "calories": 2200,
  "caloriesGoal": 2400,
  "protein": 140,
  "proteinGoal": 150,
  "carbs": 220,
  "carbsGoal": 240,
  "fat": 55,
  "fatGoal": 60,
  "steps": 8500,
  "stepsGoal": 10000,
  "water": 6,
  "waterGoal": 8
}
```

### Update Daily Stats

```http
PATCH /api/daily-stats/:id
Authorization: Required
Content-Type: application/json

{
  "water": 7,
  "steps": 9200
}
```

### Get Weekly Stats

```http
GET /api/weekly-stats?startDate=2026-02-03
Authorization: Required
```

### Get User Points

```http
GET /api/user-points
Authorization: Required
```

**Response:**
```json
{
  "userId": 1,
  "totalPoints": 1250,
  "currentStreak": 7,
  "longestStreak": 14,
  "lastActivityDate": "2026-02-10"
}
```

### Progress Snapshots

#### List Snapshots

```http
GET /api/progress-snapshots?startDate=2026-01-01&endDate=2026-02-10
Authorization: Required
```

#### Create Snapshot

```http
POST /api/progress-snapshots
Authorization: Required
Content-Type: application/json

{
  "recordDate": "2026-02-10",
  "weight": 73.5,
  "bodyFat": 15.2,
  "muscleMass": 62.5,
  "measurements": {
    "chest": 100,
    "waist": 82,
    "hips": 98,
    "arms": 35,
    "thighs": 58
  },
  "photos": [12, 13, 14],
  "notes": "Monthly check-in"
}
```

---

## E-Commerce

### List Products

```http
GET /api/products?category=supplements&search=protein
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "Whey Protein Gold Standard",
    "description": "Premium whey protein powder",
    "price": 199.99,
    "imageUrl": "https://...",
    "category": "supplements",
    "rating": 4.5,
    "reviewCount": 234,
    "stock": 50
  }
]
```

### Get Product Details

```http
GET /api/products/:id
```

### Create Product

```http
POST /api/products
Authorization: Required (Admin)
Content-Type: application/json

{
  "name": "BCAA Energy Drink",
  "description": "Amino acids for recovery",
  "price": 89.99,
  "imageUrl": "https://...",
  "category": "supplements",
  "stock": 100
}
```

### Update Product

```http
PATCH /api/products/:id
Authorization: Required (Admin)
Content-Type: application/json

{
  "price": 79.99,
  "stock": 150
}
```

### Delete Product

```http
DELETE /api/products/:id
Authorization: Required (Admin)
```

### Shopping Cart

#### Get Cart

```http
GET /api/cart
Authorization: Required
```

**Response:**
```json
{
  "items": [
    {
      "id": 1,
      "userId": 1,
      "productId": 5,
      "quantity": 2,
      "product": {
        "name": "Whey Protein",
        "price": 199.99,
        "imageUrl": "https://..."
      }
    }
  ],
  "total": 399.98
}
```

#### Add to Cart

```http
POST /api/cart
Authorization: Required
Content-Type: application/json

{
  "productId": 5,
  "quantity": 2
}
```

#### Update Cart Item

```http
PATCH /api/cart/:productId
Authorization: Required
Content-Type: application/json

{
  "quantity": 3
}
```

#### Remove from Cart

```http
DELETE /api/cart/:productId
Authorization: Required
```

#### Clear Cart

```http
DELETE /api/cart
Authorization: Required
```

### Orders

#### Checkout

```http
POST /api/cart/checkout
Authorization: Required
Content-Type: application/json

{
  "shippingAddress": "123 Main St",
  "shippingCity": "Riyadh",
  "shippingCountry": "Saudi Arabia",
  "shippingPhone": "+966512345678",
  "paymentMethod": "card",
  "notes": "Please deliver in the morning"
}
```

**Response:** `201 Created`
```json
{
  "orderId": 123,
  "total": 399.98,
  "status": "pending"
}
```

#### List Orders

```http
GET /api/orders?status=delivered
Authorization: Required
```

**Response:**
```json
[
  {
    "id": 123,
    "userId": 1,
    "status": "delivered",
    "total": 399.98,
    "currency": "SAR",
    "paymentMethod": "card",
    "paymentStatus": "paid",
    "createdAt": "2026-02-05T10:00:00Z",
    "completedAt": "2026-02-08T14:30:00Z",
    "items": [...]
  }
]
```

#### Get Order Details

```http
GET /api/orders/:id
Authorization: Required
```

#### Update Order

```http
PATCH /api/orders/:id
Authorization: Required (Admin)
Content-Type: application/json

{
  "status": "shipped",
  "trackingNumber": "ABC123XYZ"
}
```

#### Admin: List All Orders

```http
GET /api/admin/orders?page=1&limit=50&status=pending
Authorization: Required (Admin)
```

---

## Messaging

### List Messages

```http
GET /api/messages?otherUserId=5
Authorization: Required
```

**Response:**
```json
[
  {
    "id": 1,
    "senderId": 1,
    "receiverId": 5,
    "content": "Hi coach, I have a question...",
    "sentAt": "2026-02-10T10:00:00Z",
    "read": true
  }
]
```

### Send Message

```http
POST /api/messages
Authorization: Required
Content-Type: application/json

{
  "receiverId": 5,
  "content": "When should I take my supplements?"
}
```

### Mark Message as Read

```http
PATCH /api/messages/:id/read
Authorization: Required
```

### Admin: List Conversations

```http
GET /api/admin/conversations
Authorization: Required (Admin)
```

**Response:**
```json
[
  {
    "userId": 1,
    "userName": "John Doe",
    "lastMessage": "Thanks for the help!",
    "lastMessageAt": "2026-02-10T15:30:00Z",
    "unreadCount": 0
  }
]
```

### Admin: Get Conversation

```http
GET /api/admin/conversations/:userId
Authorization: Required (Admin)
```

---

## Courses & Learning

### List Courses

```http
GET /api/courses?category=fitness&level=beginner&status=published
```

**Query Parameters:**
- `category`: fitness, nutrition, wellness, business
- `level`: beginner, intermediate, advanced
- `status`: draft, published, archived
- `featured`: true/false

**Response:**
```json
[
  {
    "id": 1,
    "title": "Complete Fitness Fundamentals",
    "titleAr": "أساسيات اللياقة البدنية الكاملة",
    "description": "Learn the basics of fitness training",
    "category": "fitness",
    "level": "beginner",
    "duration": 10,
    "thumbnailUrl": "https://...",
    "price": 299.99,
    "currency": "SAR",
    "isFree": false,
    "instructorId": 5,
    "status": "published",
    "featured": true,
    "enrollmentCount": 156,
    "averageRating": 4.7
  }
]
```

### Get Course Details

```http
GET /api/courses/:id
```

### Create Course

```http
POST /api/courses
Authorization: Required (Coach/Admin)
Content-Type: application/json

{
  "title": "Advanced Nutrition Science",
  "titleAr": "علم التغذية المتقدم",
  "description": "Deep dive into nutrition",
  "category": "nutrition",
  "level": "advanced",
  "duration": 20,
  "price": 499.99,
  "certificateEnabled": true
}
```

### Update Course

```http
PATCH /api/courses/:id
Authorization: Required (Coach/Admin)
Content-Type: application/json

{
  "price": 399.99,
  "status": "published",
  "publishedAt": "2026-02-10T00:00:00Z"
}
```

### Delete Course

```http
DELETE /api/courses/:id
Authorization: Required (Coach/Admin)
```

### Course Lessons

#### List Lessons

```http
GET /api/courses/:courseId/lessons
```

**Response:**
```json
[
  {
    "id": 1,
    "courseId": 1,
    "title": "Introduction to Training",
    "titleAr": "مقدمة في التدريب",
    "orderIndex": 1,
    "type": "video",
    "duration": 15,
    "videoUrl": "https://...",
    "isPreview": true,
    "status": "published"
  }
]
```

#### Get Lesson Details

```http
GET /api/lessons/:id
Authorization: Required (if not preview)
```

#### Create Lesson

```http
POST /api/courses/:courseId/lessons
Authorization: Required (Coach/Admin)
Content-Type: application/json

{
  "title": "Workout Programming Basics",
  "titleAr": "أساسيات برمجة التمارين",
  "description": "Learn how to design workout programs",
  "content": "...",
  "orderIndex": 2,
  "type": "article",
  "duration": 10,
  "isPreview": false
}
```

#### Update Lesson

```http
PATCH /api/lessons/:id
Authorization: Required (Coach/Admin)
Content-Type: application/json

{
  "videoUrl": "https://...",
  "duration": 20
}
```

#### Delete Lesson

```http
DELETE /api/lessons/:id
Authorization: Required (Coach/Admin)
```

### Course Enrollment

#### Enroll in Course

```http
POST /api/courses/:courseId/enroll
Authorization: Required
```

**Response:** `201 Created`

#### Check Enrollment Status

```http
GET /api/courses/:courseId/enrollment-status
Authorization: Required
```

**Response:**
```json
{
  "enrolled": true,
  "progress": 45,
  "currentLessonId": 3,
  "completed": false
}
```

#### List User Enrollments

```http
GET /api/user/enrollments
Authorization: Required
```

#### Unenroll from Course

```http
POST /api/courses/:courseId/unenroll
Authorization: Required
```

### Lesson Progress

#### Complete Lesson

```http
POST /api/lessons/:lessonId/complete
Authorization: Required
Content-Type: application/json

{
  "timeSpent": 900,
  "quizScore": 85,
  "quizAttempts": 1
}
```

#### Get Lesson Progress

```http
GET /api/lessons/:lessonId/progress
Authorization: Required
```

### Certificates

#### List User Certificates

```http
GET /api/user/certificates
Authorization: Required
```

**Response:**
```json
[
  {
    "id": 1,
    "courseId": 1,
    "courseName": "Complete Fitness Fundamentals",
    "certificateUrl": "https://...",
    "issuedAt": "2026-02-10T00:00:00Z"
  }
]
```

#### Issue Certificate to User

```http
POST /api/courses/:courseId/issue-certificate
Authorization: Required (Coach/Admin)
Content-Type: application/json

{
  "userId": 1,
  "notes": "Excellent performance"
}
```

#### Coach: Manage Certificates

```http
GET /api/coach/certificates
Authorization: Required (Coach)
```

```http
POST /api/coach/certificates
Authorization: Required (Coach)
Content-Type: application/json

{
  "courseId": 1,
  "title": "Fitness Mastery Certificate",
  "titleAr": "شهادة إتقان اللياقة البدنية",
  "templateUrl": "https://...",
  "issueAutomatically": true
}
```

---

## Supplements

### List Supplements

```http
GET /api/supplements?category=protein&search=whey
Authorization: Required
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "Whey Protein Isolate",
    "nameAr": "واي بروتين معزول",
    "forms": ["powder", "capsule"],
    "categories": ["protein", "post-workout"],
    "dosageRangeMin": 20,
    "dosageRangeMax": 30,
    "dosageUnit": "g",
    "isGlobal": true
  }
]
```

### Get Supplement Details

```http
GET /api/supplements/:id
Authorization: Required
```

### Create Supplement

```http
POST /api/supplements
Authorization: Required (Coach/Admin)
Content-Type: application/json

{
  "name": "Creatine Monohydrate",
  "nameAr": "كرياتين أحادي الهيدرات",
  "forms": ["powder"],
  "categories": ["performance", "strength"],
  "dosageRangeMin": 3,
  "dosageRangeMax": 5,
  "dosageUnit": "g",
  "contraindications": "Kidney issues",
  "warnings": "Increase water intake"
}
```

### Supplement Recommendations

#### List User Supplements

```http
GET /api/supplement-recommendations?userId=1&status=active
Authorization: Required
```

**Response:**
```json
[
  {
    "id": 1,
    "userId": 1,
    "supplementId": 5,
    "supplement": {
      "name": "Omega-3 Fish Oil",
      "nameAr": "أوميغا-3 زيت السمك"
    },
    "dosageAmount": 2,
    "dosageUnit": "capsules",
    "dosageFrequency": "twice_daily",
    "timingType": "with_meals",
    "status": "active",
    "coachId": 5,
    "startDate": "2026-02-01",
    "endDate": null
  }
]
```

#### Add Supplement Recommendation

```http
POST /api/supplement-recommendations
Authorization: Required (Coach)
Content-Type: application/json

{
  "userId": 1,
  "supplementId": 5,
  "dosageAmount": 2,
  "dosageUnit": "capsules",
  "dosageFrequency": "twice_daily",
  "timingType": "with_meals",
  "coachNotes": "Take with food to improve absorption"
}
```

#### Update Recommendation

```http
PATCH /api/supplement-recommendations/:id
Authorization: Required (Coach)
Content-Type: application/json

{
  "status": "paused",
  "dosageAmount": 1
}
```

### Supplement Reminders

```http
GET /api/supplement-reminders?userId=1
Authorization: Required
```

```http
POST /api/supplement-reminders
Authorization: Required
Content-Type: application/json

{
  "recommendationId": 1,
  "enabled": true,
  "reminderTimes": ["08:00", "20:00"],
  "reminderDays": ["monday", "tuesday", "wednesday", "thursday", "friday"]
}
```

### Side Effects

#### Report Side Effect

```http
POST /api/supplement-side-effects
Authorization: Required
Content-Type: application/json

{
  "recommendationId": 1,
  "severity": "mild",
  "symptoms": "Slight stomach discomfort",
  "occurredAt": "2026-02-10T14:00:00Z",
  "photo": "https://..."
}
```

#### List Side Effects

```http
GET /api/supplement-side-effects?userId=1&status=active
Authorization: Required
```

### Effectiveness Ratings

```http
POST /api/supplement-effectiveness-ratings
Authorization: Required
Content-Type: application/json

{
  "recommendationId": 1,
  "rating": 4,
  "notes": "Noticeable improvement in recovery",
  "ratingPeriodStart": "2026-01-01",
  "ratingPeriodEnd": "2026-02-10"
}
```

---

## Notifications & Reminders

### List Notifications

```http
GET /api/notifications?type=workout&status=unread
Authorization: Required
```

**Response:**
```json
[
  {
    "id": 1,
    "userId": 1,
    "type": "workout",
    "title": "Workout Reminder",
    "titleAr": "تذكير بالتمرين",
    "message": "Don't forget your morning workout!",
    "messageAr": "لا تنس تمرينك الصباحي!",
    "scheduledFor": "2026-02-11T06:00:00Z",
    "status": "sent",
    "readAt": null
  }
]
```

### Create Notification

```http
POST /api/notifications
Authorization: Required (Admin/Coach)
Content-Type: application/json

{
  "userId": 1,
  "type": "motivational",
  "title": "Keep Going!",
  "titleAr": "استمر!",
  "message": "You're doing great!",
  "messageAr": "أنت تقوم بعمل رائع!",
  "scheduledFor": "2026-02-11T09:00:00Z"
}
```

### Mark as Read

```http
PUT /api/notifications/:id/read
Authorization: Required
```

### Delete Notification

```http
DELETE /api/notifications/:id
Authorization: Required
```

### Reminder Settings

#### Get Reminder Settings

```http
GET /api/reminder-settings
Authorization: Required
```

**Response:**
```json
[
  {
    "id": 1,
    "userId": 1,
    "reminderType": "workout",
    "enabled": true,
    "times": ["06:00", "18:00"],
    "days": ["monday", "wednesday", "friday"],
    "customMessage": "Time for your workout!"
  }
]
```

#### Create/Update Reminder Settings

```http
POST /api/reminder-settings
Authorization: Required
Content-Type: application/json

{
  "reminderType": "meal",
  "enabled": true,
  "times": ["08:00", "13:00", "19:00"],
  "days": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
}
```

### Achievements

#### List User Achievements

```http
GET /api/achievements?userId=1
Authorization: Required
```

**Response:**
```json
[
  {
    "id": 1,
    "userId": 1,
    "achievementType": "workout_streak",
    "title": "7-Day Streak!",
    "titleAr": "سلسلة 7 أيام!",
    "description": "Completed workouts for 7 days straight",
    "value": 7,
    "achievedAt": "2026-02-10T00:00:00Z",
    "notificationSent": true
  }
]
```

#### Create Achievement

```http
POST /api/achievements
Authorization: Required (Admin)
Content-Type: application/json

{
  "userId": 1,
  "achievementType": "weight_milestone",
  "title": "Goal Weight Achieved!",
  "description": "Reached your target weight",
  "value": 75
}
```

### Motivational Templates

```http
GET /api/motivational-templates
Authorization: Required (Coach/Admin)
```

```http
POST /api/motivational-templates
Authorization: Required (Admin)
Content-Type: application/json

{
  "trigger": "streak_achieved",
  "title": "Amazing Consistency!",
  "titleAr": "انتظام مذهل!",
  "message": "You've maintained your streak for {days} days!",
  "messageAr": "لقد حافظت على سلسلتك لمدة {days} أيام!",
  "minStreakDays": 7,
  "priority": 1
}
```

---

## Files & Reports

### File Upload

```http
POST /api/files/upload
Authorization: Required
Content-Type: multipart/form-data

{
  "file": <binary>,
  "fileType": "progress_photo",
  "description": "Front progress photo",
  "visibility": "coach_visible",
  "tags": ["progress", "front"]
}
```

**Response:** `201 Created`
```json
{
  "id": 1,
  "fileName": "progress_feb_2026.jpg",
  "fileUrl": "https://...",
  "fileSize": 245680,
  "fileType": "progress_photo",
  "uploadDate": "2026-02-10T15:30:00Z"
}
```

### List Files

```http
GET /api/files?fileType=progress_photo&userId=1
Authorization: Required
```

### Create File Record

```http
POST /api/files
Authorization: Required
Content-Type: application/json

{
  "fileName": "workout_plan.pdf",
  "fileUrl": "https://...",
  "fileSize": 512000,
  "mimeType": "application/pdf",
  "fileType": "pdf",
  "visibility": "private"
}
```

### Get File Details

```http
GET /api/files/:id
Authorization: Required
```

### Update File

```http
PUT /api/files/:id
Authorization: Required
Content-Type: application/json

{
  "description": "Updated description",
  "tags": ["workout", "plan", "february"]
}
```

### Delete File

```http
DELETE /api/files/:id
Authorization: Required
```

### Reports

#### List Reports

```http
GET /api/reports?reportType=weekly&userId=1
Authorization: Required
```

#### Generate Report

```http
POST /api/reports/generate
Authorization: Required
Content-Type: application/json

{
  "userId": 1,
  "reportType": "monthly",
  "periodStart": "2026-01-01",
  "periodEnd": "2026-01-31"
}
```

**Response:** `201 Created`
```json
{
  "id": 1,
  "reportType": "monthly",
  "periodStart": "2026-01-01",
  "periodEnd": "2026-01-31",
  "reportData": {
    "workoutsCompleted": 24,
    "avgCalories": 2150,
    "weightChange": -2.5,
    "progressSummary": "..."
  },
  "pdfUrl": "https://..."
}
```

#### Get Report

```http
GET /api/reports/:id
Authorization: Required
```

#### Coach: Comparison Report

```http
GET /api/coach/reports/comparison?userIds=1,2,3&period=month
Authorization: Required (Coach)
```

#### Generate AI Report

```http
POST /api/reports/generate-ai
Authorization: Required
Content-Type: application/json

{
  "userId": 1,
  "reportType": "weekly",
  "periodStart": "2026-02-03",
  "periodEnd": "2026-02-10",
  "includeInsights": true
}
```

---

## AI Assistant

### Ask Question

```http
POST /api/ai-assistant/ask
Authorization: Required
Content-Type: application/json

{
  "question": "What should I eat before my workout?",
  "language": "en",
  "context": {
    "workoutTime": "06:00",
    "fitnessGoal": "weight_loss"
  }
}
```

**Response:**
```json
{
  "answer": "For a morning workout focused on weight loss, I recommend...",
  "confidenceScore": 0.92,
  "relatedTopics": ["pre-workout-nutrition", "morning-workouts"]
}
```

### Get Conversations

```http
GET /api/ai-assistant/conversations?limit=20
Authorization: Required
```

### Get Guidance

```http
GET /api/ai-assistant/guidance?topic=nutrition
Authorization: Required
```

### Delete Conversation

```http
DELETE /api/ai-assistant/conversations/:id
Authorization: Required
```

### Troubleshoot

```http
GET /api/ai-assistant/troubleshoot?issue=missed_workouts
Authorization: Required
```

### AI Insights

#### List Insights

```http
GET /api/ai-insights?userId=1&insightType=risk_prediction
Authorization: Required
```

**Response:**
```json
[
  {
    "id": 1,
    "userId": 1,
    "insightType": "risk_prediction",
    "title": "Potential Burnout Risk",
    "titleAr": "خطر محتمل للإرهاق",
    "description": "Your workout intensity has increased significantly...",
    "confidenceScore": 0.85,
    "riskLevel": "moderate",
    "trend": "declining",
    "keySignals": [
      {
        "signal": "workout_intensity_increase",
        "value": 35,
        "importance": "high"
      }
    ],
    "isActive": true,
    "createdAt": "2026-02-10T00:00:00Z"
  }
]
```

#### Analyze User Data

```http
POST /api/ai-insights/analyze
Authorization: Required
Content-Type: application/json

{
  "userId": 1,
  "analysisType": "progress_analysis",
  "period": "last_30_days"
}
```

#### Update Insight

```http
PUT /api/ai-insights/:id
Authorization: Required (Coach/Admin)
Content-Type: application/json

{
  "isActive": false,
  "resolutionNotes": "Issue addressed with client"
}
```

### AI Plan Suggestions

#### List Suggestions

```http
GET /api/ai-plan-suggestions?userId=1&status=pending
Authorization: Required (Coach)
```

**Response:**
```json
[
  {
    "id": 1,
    "userId": 1,
    "suggestionType": "rest_days",
    "title": "Add Recovery Day",
    "rationale": "User shows signs of fatigue...",
    "currentPlan": {...},
    "suggestedPlan": {...},
    "status": "pending",
    "createdAt": "2026-02-10T00:00:00Z"
  }
]
```

#### Create Suggestion

```http
POST /api/ai-plan-suggestions
Authorization: Required (Coach)
Content-Type: application/json

{
  "userId": 1,
  "suggestionType": "calorie_target",
  "title": "Adjust Calorie Target",
  "rationale": "Based on recent progress...",
  "suggestedPlan": {
    "dailyCalories": 2300
  }
}
```

#### Approve Suggestion

```http
PUT /api/ai-plan-suggestions/:id/approve
Authorization: Required (Coach)
Content-Type: application/json

{
  "notes": "Approved and applied to user plan"
}
```

#### Reject Suggestion

```http
PUT /api/ai-plan-suggestions/:id/reject
Authorization: Required (Coach)
Content-Type: application/json

{
  "rejectionReason": "Not appropriate at this time"
}
```

### Escalations

#### List Escalations

```http
GET /api/escalations?status=pending&priority=high
Authorization: Required (Coach/Admin)
```

**Response:**
```json
[
  {
    "id": 1,
    "userId": 1,
    "escalationType": "coach_handoff",
    "triggerSource": "side_effect",
    "priority": "high",
    "status": "pending",
    "title": "Supplement Side Effect",
    "description": "User reported severe discomfort...",
    "createdAt": "2026-02-10T10:00:00Z"
  }
]
```

#### Create Escalation

```http
POST /api/escalations
Authorization: Required
Content-Type: application/json

{
  "escalationType": "coach_handoff",
  "triggerSource": "user_request",
  "priority": "medium",
  "title": "Need Nutrition Consultation",
  "description": "I would like to discuss my meal plan"
}
```

#### Update Escalation

```http
PUT /api/escalations/:id
Authorization: Required (Coach/Admin)
Content-Type: application/json

{
  "status": "in_progress",
  "assignedTo": 5,
  "scheduledAt": "2026-02-11T14:00:00Z"
}
```

### AI Agent Chat

```http
POST /api/ai-agent/chat
Authorization: Required
Content-Type: application/json

{
  "message": "Create a workout plan for me",
  "conversationId": "abc123",
  "language": "en"
}
```

---

## Credit & Billing

### Get Credit Account

```http
GET /api/credits/account
Authorization: Required
```

**Response:**
```json
{
  "id": "uuid",
  "userId": 1,
  "balance": 150,
  "lowBalanceThreshold": 10,
  "createdAt": "2026-01-01T00:00:00Z"
}
```

### List Credit Bundles

```http
GET /api/credits/bundles
Authorization: Required
```

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Starter Pack",
    "credits": 100,
    "priceCents": 9900,
    "currency": "usd",
    "isActive": true,
    "sortOrder": 1
  },
  {
    "id": "uuid",
    "name": "Pro Pack",
    "credits": 500,
    "priceCents": 39900,
    "currency": "usd",
    "isActive": true,
    "sortOrder": 2
  }
]
```

### Purchase Credits

```http
POST /api/credits/purchase
Authorization: Required
Content-Type: application/json

{
  "bundleId": "uuid",
  "paymentMethod": "stripe"
}
```

**Response:**
```json
{
  "checkoutSessionId": "cs_test_...",
  "checkoutUrl": "https://checkout.stripe.com/..."
}
```

### List Credit Transactions

```http
GET /api/credits/transactions?limit=50
Authorization: Required
```

**Response:**
```json
[
  {
    "id": "uuid",
    "type": "purchase",
    "creditsDelta": 100,
    "balanceAfter": 150,
    "provider": "stripe",
    "status": "completed",
    "createdAt": "2026-02-10T10:00:00Z"
  },
  {
    "id": "uuid",
    "type": "deduction",
    "creditsDelta": -5,
    "balanceAfter": 145,
    "actionKey": "ai_chat_message",
    "status": "completed",
    "createdAt": "2026-02-10T11:00:00Z"
  }
]
```

### List Credit Actions

```http
GET /api/credits/actions
Authorization: Required
```

**Response:**
```json
[
  {
    "id": "uuid",
    "actionKey": "ai_chat_message",
    "description": "AI Chat Message",
    "cost": 5,
    "isActive": true
  },
  {
    "id": "uuid",
    "actionKey": "ai_plan_generation",
    "description": "AI Plan Generation",
    "cost": 20,
    "isActive": true
  }
]
```

### Admin: Manage Credit Bundles

```http
POST /api/admin/credits/bundles
Authorization: Required (Admin)
Content-Type: application/json

{
  "name": "Enterprise Pack",
  "credits": 2000,
  "priceCents": 149900,
  "currency": "usd",
  "sortOrder": 3
}
```

```http
PATCH /api/admin/credits/bundles/:id
Authorization: Required (Admin)
Content-Type: application/json

{
  "priceCents": 139900,
  "isActive": true
}
```

### Admin: Manage Credit Actions

```http
POST /api/admin/credits/actions
Authorization: Required (Admin)
Content-Type: application/json

{
  "actionKey": "ai_workout_generation",
  "description": "AI Workout Generation",
  "cost": 15
}
```

```http
PATCH /api/admin/credits/actions/:id
Authorization: Required (Admin)
Content-Type: application/json

{
  "cost": 12,
  "isActive": true
}
```

### Admin: Adjust User Credits

```http
POST /api/admin/credits/adjust
Authorization: Required (Admin)
Content-Type: application/json

{
  "userId": 1,
  "creditsDelta": 50,
  "reason": "Promotional bonus"
}
```

---

## Payment Processing

### Get Stripe Publishable Key

```http
GET /api/stripe/publishable-key
```

**Response:**
```json
{
  "publishableKey": "pk_test_..."
}
```

### Check Stripe Status

```http
GET /api/stripe/status
Authorization: Required
```

**Response:**
```json
{
  "configured": true,
  "mode": "test"
}
```

### Create Checkout Session

```http
POST /api/stripe/create-checkout-session
Authorization: Required
Content-Type: application/json

{
  "bundleId": "uuid",
  "successUrl": "https://app.example.com/success",
  "cancelUrl": "https://app.example.com/cancel"
}
```

**Response:**
```json
{
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/..."
}
```

### Verify Session

```http
GET /api/stripe/verify-session/:sessionId
Authorization: Required
```

**Response:**
```json
{
  "status": "complete",
  "paymentStatus": "paid",
  "amountTotal": 9900,
  "currency": "usd",
  "credits": 100
}
```

### Admin: Payment Settings

#### Get Settings

```http
GET /api/admin/payment-settings
Authorization: Required (Admin)
```

**Response:**
```json
{
  "stripePublishableKey": "pk_test_...",
  "stripeConfigured": true,
  "paymentMode": "test"
}
```

#### Update Settings

```http
POST /api/admin/payment-settings
Authorization: Required (Admin)
Content-Type: application/json

{
  "stripeSecretKey": "sk_test_...",
  "stripeWebhookSecret": "whsec_..."
}
```

#### Test Settings

```http
POST /api/admin/payment-settings/test
Authorization: Required (Admin)
```

#### List Transactions

```http
GET /api/admin/payment-transactions?page=1&limit=50&status=succeeded
Authorization: Required (Admin)
```

---

## Community & Social

### Groups

#### List Groups

```http
GET /api/community/groups?goalType=weight_loss&groupType=public
Authorization: Required
```

#### Create Group

```http
POST /api/community/groups
Authorization: Required
Content-Type: application/json

{
  "name": "Weight Loss Warriors",
  "nameAr": "محاربو فقدان الوزن",
  "description": "Support group for weight loss journey",
  "goalType": "weight_loss",
  "groupType": "public",
  "maxMembers": 50
}
```

#### Join Group

```http
POST /api/community/groups/:id/join
Authorization: Required
```

#### Leave Group

```http
POST /api/community/groups/:id/leave
Authorization: Required
```

### Challenges

#### List Challenges

```http
GET /api/community/challenges?status=active
Authorization: Required
```

#### Create Challenge

```http
POST /api/community/challenges
Authorization: Required
Content-Type: application/json

{
  "name": "30-Day Workout Challenge",
  "nameAr": "تحدي التمرين لمدة 30 يومًا",
  "description": "Complete 30 workouts in 30 days",
  "challengeType": "workout_count",
  "metricName": "workouts_completed",
  "targetValue": 30,
  "startDate": "2026-03-01",
  "endDate": "2026-03-31",
  "isPublic": true
}
```

#### Join Challenge

```http
POST /api/community/challenges/:id/join
Authorization: Required
```

#### Update Challenge Progress

```http
POST /api/community/challenges/:id/progress
Authorization: Required
Content-Type: application/json

{
  "currentValue": 15
}
```

### Discussions

#### List Topics

```http
GET /api/community/groups/:groupId/topics
Authorization: Required
```

#### Create Topic

```http
POST /api/community/groups/:groupId/topics
Authorization: Required
Content-Type: application/json

{
  "title": "Best Pre-Workout Snacks?",
  "content": "What do you all eat before working out?"
}
```

#### Reply to Topic

```http
POST /api/community/topics/:topicId/replies
Authorization: Required
Content-Type: application/json

{
  "content": "I usually have a banana with peanut butter",
  "parentReplyId": null
}
```

### Workshops

#### List Workshops

```http
GET /api/community/workshops?status=scheduled
Authorization: Required
```

#### Register for Workshop

```http
POST /api/community/workshops/:id/register
Authorization: Required
```

### Friendships

```http
POST /api/community/friendships/request
Authorization: Required
Content-Type: application/json

{
  "friendId": 5
}
```

```http
PATCH /api/community/friendships/:id/accept
Authorization: Required
```

### Referrals

```http
GET /api/referrals/my-code
Authorization: Required
```

**Response:**
```json
{
  "referralCode": "USER123ABC",
  "referralUrl": "https://app.example.com/signup?ref=USER123ABC",
  "totalReferrals": 5,
  "totalRewards": 250
}
```

```http
GET /api/referrals/stats
Authorization: Required
```

---

## Admin & Management

### User Activity

```http
GET /api/admin/users/:userId/activity?days=30
Authorization: Required (Admin)
```

**Response:**
```json
{
  "loginCount": 25,
  "lastLogin": "2026-02-10T08:00:00Z",
  "workoutsCompleted": 12,
  "mealsLogged": 45,
  "messagesCount": 18,
  "avgSessionDuration": 1200
}
```

### User Summary

```http
GET /api/admin/users/:userId/summary
Authorization: Required (Admin)
```

**Response:**
```json
{
  "user": {...},
  "stats": {
    "totalWorkouts": 150,
    "totalMeals": 450,
    "currentStreak": 7,
    "totalPoints": 1250
  },
  "subscription": {
    "type": "6_months",
    "startDate": "2026-01-01",
    "endDate": "2026-07-01",
    "daysRemaining": 141
  },
  "recentActivity": [...]
}
```

### Coach Approval (Gym)

```http
GET /api/gym/pending-coaches
Authorization: Required (Gym/Admin)
```

```http
PATCH /api/gym/coaches/:id/approval
Authorization: Required (Gym/Admin)
Content-Type: application/json

{
  "isApproved": true
}
```

### Coach Approval (Admin)

```http
PATCH /api/admin/coaches/:id/approval
Authorization: Required (Admin)
Content-Type: application/json

{
  "isApproved": true
}
```

### Gym Members

```http
GET /api/gym/members
Authorization: Required (Gym/Admin)
```

### Unassign User from Coach

```http
PATCH /api/gym/users/:id/unassign
Authorization: Required (Gym/Admin)
```

```http
PATCH /api/coach/users/:id/unassign
Authorization: Required (Coach)
```

### Admin: Settings Management

#### Tracking Settings

```http
GET /api/admin/tracking-settings
Authorization: Required (Admin)
```

```http
POST /api/admin/tracking-settings
Authorization: Required (Admin)
Content-Type: application/json

{
  "metaPixelId": "123456789",
  "metaPixelAccessToken": "...",
  "googleAdsConversionId": "AW-123456789",
  "googleAnalyticsMeasurementId": "G-XXXXXXXXXX"
}
```

#### AI Settings

```http
GET /api/admin/ai-settings
Authorization: Required (Admin)
```

```http
POST /api/admin/ai-settings
Authorization: Required (Admin)
Content-Type: application/json

{
  "openaiApiKey": "sk-...",
  "model": "gpt-4",
  "maxTokens": 2000
}
```

---

## SaaS Multi-Tenancy

### Create Payment Session (SaaS Signup)

```http
POST /saas/create-payment-session
Content-Type: application/json

{
  "plan": "pro",
  "tenantName": "MyGym",
  "email": "owner@mygym.com",
  "billingInterval": "monthly"
}
```

**Response:**
```json
{
  "sessionId": "cs_...",
  "checkoutUrl": "https://checkout.stripe.com/..."
}
```

### Provision Tenant

```http
POST /saas/provision
Content-Type: application/json

{
  "sessionId": "cs_...",
  "subdomain": "mygym",
  "ownerEmail": "owner@mygym.com",
  "ownerPassword": "securepassword",
  "businessName": "My Gym"
}
```

**Response:** `201 Created`
```json
{
  "tenantId": "uuid",
  "subdomain": "mygym",
  "status": "provisioning",
  "adminUrl": "https://mygym.naioshfit.com/admin"
}
```

### Get Plan Config

```http
GET /saas/plan-config
```

**Response:**
```json
{
  "plans": [
    {
      "id": "starter",
      "name": "Starter",
      "priceMonthly": 2900,
      "priceYearly": 29000,
      "features": ["50 users", "Basic AI", "Email support"]
    },
    {
      "id": "pro",
      "name": "Professional",
      "priceMonthly": 9900,
      "priceYearly": 99000,
      "features": ["500 users", "Advanced AI", "Priority support"]
    }
  ]
}
```

### Check Provisioning Status

```http
GET /saas/provisioning-status/:tenantId
```

**Response:**
```json
{
  "tenantId": "uuid",
  "status": "active",
  "subdomain": "mygym",
  "completedAt": "2026-02-10T10:30:00Z"
}
```

### Signup (Tenant User)

```http
POST /saas/signup
Content-Type: application/json
X-Tenant-ID: uuid

{
  "username": "user@example.com",
  "password": "securepassword",
  "firstName": "John",
  "lastName": "Doe"
}
```

### Get Tenant Context

```http
GET /saas/tenant-context
X-Tenant-ID: uuid
```

**Response:**
```json
{
  "tenantId": "uuid",
  "subdomain": "mygym",
  "businessName": "My Gym",
  "plan": "pro",
  "features": [...]
}
```

### Admin: List Tenants

```http
GET /api/admin/saas/tenants?page=1&limit=50&status=active
Authorization: Required (Super Admin)
```

### Admin: Get Tenant Details

```http
GET /api/admin/saas/tenants/:tenantId
Authorization: Required (Super Admin)
```

### Admin: Update Tenant

```http
PATCH /api/admin/saas/tenants/:tenantId
Authorization: Required (Super Admin)
Content-Type: application/json

{
  "businessName": "Updated Gym Name",
  "plan": "enterprise"
}
```

### Admin: Update Tenant Status

```http
PATCH /api/admin/saas/tenants/:tenantId/status
Authorization: Required (Super Admin)
Content-Type: application/json

{
  "status": "suspended",
  "reason": "Payment overdue"
}
```

### Admin: Delete Tenant

```http
DELETE /api/admin/saas/tenants/:tenantId
Authorization: Required (Super Admin)
```

---

## SEO & Settings

### Get SEO Settings (Public)

```http
GET /api/seo
```

**Response:**
```json
{
  "titleTemplate": "NaioshFit - %s",
  "metaDescription": "Transform your fitness journey",
  "ogImageUrl": "https://...",
  "robotsIndex": true,
  "robotsFollow": true
}
```

### Get SEO Settings (Admin)

```http
GET /api/admin/seo
Authorization: Required (Admin)
```

### Update SEO Settings

```http
PUT /api/admin/seo
Authorization: Required (Admin)
Content-Type: application/json

{
  "titleTemplate": "NaioshFit - %s",
  "titleTemplateEn": "NaioshFit - %s",
  "titleTemplateAr": "نايوش فت - %s",
  "metaDescription": "Transform your fitness journey",
  "metaDescriptionEn": "Transform your fitness journey with AI-powered coaching",
  "metaDescriptionAr": "حوّل رحلتك في اللياقة البدنية مع التدريب المدعوم بالذكاء الاصطناعي",
  "ogImageUrl": "https://...",
  "robotsIndex": true,
  "robotsFollow": true
}
```

### Robots.txt

```http
GET /robots.txt
```

### Sitemap.xml

```http
GET /sitemap.xml
```

---

## Webhooks

### Stripe Webhook (Platform)

```http
POST /api/admin/stripe/webhook
Content-Type: application/json
Stripe-Signature: t=...

{
  "type": "checkout.session.completed",
  "data": {...}
}
```

### Stripe Webhook (Tenant)

```http
POST /api/stripe/webhook
Content-Type: application/json
Stripe-Signature: t=...

{
  "type": "checkout.session.completed",
  "data": {...}
}
```

---

## SDKs & Libraries

### Official SDKs

- **JavaScript/TypeScript**: `@naioshfit/sdk-js`
- **Python**: `naioshfit-sdk`
- **Mobile (React Native)**: `@naioshfit/react-native-sdk`

### Example: JavaScript SDK

```javascript
import NaioshFit from '@naioshfit/sdk-js';

const client = new NaioshFit({
  baseUrl: 'https://api.naioshfit.com',
  sessionCookie: 'your-session-cookie'
});

// Get current user
const user = await client.auth.me();

// List workouts
const workouts = await client.workouts.list({
  difficulty: 'intermediate'
});

// Create meal
const meal = await client.meals.create({
  name: 'Breakfast',
  type: 'breakfast',
  calories: 350,
  proteins: 12,
  carbs: 55,
  fats: 8
});
```

---

## Additional Resources

- **API Status**: https://status.naioshfit.com
- **Developer Docs**: https://developers.naioshfit.com
- **Community Forum**: https://community.naioshfit.com
- **Support**: support@naioshfit.com

---

## Changelog

### Version 1.0 (February 2026)
- Initial API documentation
- All core endpoints documented
- Multi-tenant SaaS support
- Credit billing system
- AI assistant integration

---

**© 2026 NaioshFit. All rights reserved.**
