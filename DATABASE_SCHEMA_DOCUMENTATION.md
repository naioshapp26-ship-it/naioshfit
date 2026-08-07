# NaioshFit Platform - Database Schema Documentation

**Database Type:** PostgreSQL  
**ORM:** Drizzle ORM  
**Generated Date:** February 10, 2026  
**Total Tables:** 74

---

## Table of Contents

- [Overview](#overview)
- [Database Architecture](#database-architecture)
- [Core Tables](#core-tables)
  - [Users & Authentication](#users--authentication)
  - [Workouts & Training](#workouts--training)
  - [Nutrition & Meals](#nutrition--meals)
  - [Progress Tracking](#progress-tracking)
- [E-Commerce](#e-commerce)
- [Credit & Billing System](#credit--billing-system)
- [Coaching & Content](#coaching--content)
- [Affiliate & Marketing](#affiliate--marketing)
- [Gamification](#gamification)
- [Supplements System](#supplements-system)
- [Notifications & Alerts](#notifications--alerts)
- [Files & Reports](#files--reports)
- [Courses & Education](#courses--education)
- [AI Assistant](#ai-assistant)
- [Community & Social](#community--social)
- [SEO & Settings](#seo--settings)
- [Entity Relationship Diagram](#entity-relationship-diagram)
- [Indexes & Performance Optimizations](#indexes--performance-optimizations)

---

## Overview

The NaioshFit platform is a comprehensive fitness and wellness application built on PostgreSQL. The database supports:

- **User Management**: Multi-role system (users, coaches, gyms, admins)
- **Fitness Tracking**: Workouts, nutrition, progress monitoring
- **E-Commerce**: Products, orders, cart management
- **Credit System**: V2 credit accounts with bundles and transactions
- **Coaching**: Content library, coach invitations, profile management
- **Courses**: Educational content with certificates and progress tracking
- **AI Features**: Conversation tracking, insights, and plan suggestions
- **Community**: Groups, challenges, discussions, workshops
- **Supplements**: Comprehensive supplement management with warnings
- **Gamification**: Points, streaks, achievements, referrals

---

## Database Architecture

### Multi-Tenancy Support
The database supports multi-tenant architecture through:
- `tenant_id` fields in credit_accounts, credit_bundles, credit_actions, and credit_transactions_v2
- Tenant-specific isolation for SaaS deployments

### Internationalization (i18n)
Most user-facing content includes bilingual support:
- English fields (default)
- Arabic fields with `_ar` suffix

### Soft Deletes & Cascading
- Foreign key relationships use `onDelete: 'cascade'` or `onDelete: 'set null'`
- Data integrity maintained through database-level constraints

---

## Core Tables

### Users & Authentication

#### **users**
Central user table supporting multiple roles.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Unique user identifier |
| username | TEXT | UNIQUE | Login username (optional) |
| password | TEXT | NOT NULL | Hashed password |
| pinNumber | TEXT | - | 4-digit PIN for password reset |
| firstName | TEXT | NOT NULL | User's first name |
| lastName | TEXT | NOT NULL | User's last name |
| phoneNumber | TEXT | - | Phone number |
| whatsappWithCode | TEXT | - | WhatsApp with country code |
| role | TEXT | NOT NULL, DEFAULT 'user' | Role: user, coach, gym, admin |
| profilePicture | TEXT | - | Profile image URL |
| coachId | INTEGER | FK → users.id | Assigned coach |
| gymId | INTEGER | FK → users.id | Assigned gym |
| isApproved | BOOLEAN | DEFAULT true | Approval status (coaches need approval) |
| approvedAt | TIMESTAMP | - | When approved |
| approvedBy | INTEGER | FK → users.id | Admin who approved |
| createdAt | TIMESTAMP | DEFAULT NOW() | Account creation date |
| lastActivityAt | TIMESTAMP | - | Last app interaction |

**User Profile Fields:**
- Body measurements: height, weight, goalWeight, shoulder/chest/waist/hip widths
- Fitness: fitnessGoal, trainingLevel, trainingDaysPerWeek, preferredWorkoutTime, preferredProgram
- Health: medicalHistory, medicalHistoryDetails, workIntensity, workoutLocation
- Nutrition preferences: preferredCarbs, preferredProteins, preferredVegetables, etc.
- Marketing: howFoundUs, preferredCoachName
- Photos: frontPhoto, backPhoto, sidePhoto, inbodyDocument

**Relationships:**
- One user can be a coach to many users
- One user can belong to one gym
- Self-referencing for approval tracking

---

### Workouts & Training

#### **workouts**
Coach-created workout templates.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Workout template ID |
| name | TEXT | NOT NULL | Workout name |
| description | TEXT | NOT NULL | Workout description |
| duration | INTEGER | NOT NULL | Duration in minutes |
| difficulty | TEXT | NOT NULL | beginner, intermediate, advanced |
| type | TEXT | NOT NULL | Workout type/category |
| coachId | INTEGER | FK → users.id, NOT NULL | Creator coach |
| exercises | JSON | NOT NULL | Exercise list with sets/reps |

#### **user_workouts**
Scheduled workouts assigned to users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Assignment ID |
| userId | INTEGER | FK → users.id, NOT NULL | Trainee user |
| workoutId | INTEGER | FK → workouts.id, NOT NULL | Workout template |
| scheduledFor | TIMESTAMP | NOT NULL | Scheduled date/time |
| completed | BOOLEAN | DEFAULT false | Completion status |
| completedAt | TIMESTAMP | - | When completed |

#### **workout_sessions**
Logs of completed workouts (actual performance tracking).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Session ID |
| userId | INTEGER | FK → users.id, NOT NULL | User who completed workout |
| workoutId | INTEGER | FK → workouts.id | Template used (nullable for custom) |
| workoutName | TEXT | NOT NULL | Workout name snapshot |
| workoutType | TEXT | NOT NULL | regular or custom |
| completedAt | TIMESTAMP | DEFAULT NOW() | Completion timestamp |
| duration | INTEGER | - | Actual duration in minutes |
| totalSets | INTEGER | DEFAULT 0 | Total sets planned |
| completedSets | INTEGER | DEFAULT 0 | Sets actually completed |
| exercises | JSON | - | Exercise log data with performance |
| notes | TEXT | - | User notes |

**Indexes:**
- userId for user workout history queries
- completedAt for timeline filtering

---

### Nutrition & Meals

#### **meals**
User-logged meals.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Meal ID |
| userId | INTEGER | FK → users.id, NOT NULL | User who logged meal |
| name | TEXT | NOT NULL | Meal name |
| type | TEXT | NOT NULL | breakfast, lunch, dinner, snack |
| calories | INTEGER | NOT NULL | Total calories |
| proteins | REAL | NOT NULL | Protein grams |
| carbs | REAL | NOT NULL | Carbs grams |
| fats | REAL | NOT NULL | Fats grams |
| fiber | REAL | - | Fiber grams |
| date | TIMESTAMP | NOT NULL | Meal date/time |
| foodItems | JSON | - | List of food items with quantities |

#### **food_items**
Global food database.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Food item ID |
| name | TEXT | NOT NULL | English name |
| nameAr | TEXT | - | Arabic name |
| brand | TEXT | - | Brand name |
| brandAr | TEXT | - | Brand name (Arabic) |
| calories | REAL | NOT NULL | Calories per serving |
| proteins | REAL | NOT NULL | Protein grams |
| carbs | REAL | NOT NULL | Carbs grams |
| fats | REAL | NOT NULL | Fats grams |
| fiber | REAL | NOT NULL | Fiber grams |
| servingSize | TEXT | NOT NULL | Serving description |
| servingSizeGrams | REAL | NOT NULL | Serving size in grams |
| category | TEXT | NOT NULL | Food category |
| createdBy | INTEGER | FK → users.id | User/coach who added it |
| createdAt | TIMESTAMP | DEFAULT NOW() | Creation date |

---

### Progress Tracking

#### **progress**
Daily progress entries.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Progress entry ID |
| userId | INTEGER | FK → users.id, NOT NULL | User |
| date | TIMESTAMP | NOT NULL | Entry date |
| weight | REAL | - | Weight in kg |
| caloriesConsumed | INTEGER | - | Calories consumed |
| caloriesBurned | INTEGER | - | Calories burned |
| steps | INTEGER | - | Step count |
| waterGlasses | INTEGER | - | Water intake |
| notes | TEXT | - | User notes |

#### **daily_stats**
Daily nutrition and activity goals/actuals.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Stats ID |
| userId | INTEGER | FK → users.id, NOT NULL | User |
| date | TIMESTAMP | NOT NULL | Stats date |
| calories | INTEGER | DEFAULT 0 | Actual calories |
| caloriesGoal | INTEGER | DEFAULT 2200 | Calorie target |
| protein | REAL | DEFAULT 0 | Actual protein (g) |
| proteinGoal | REAL | DEFAULT 140 | Protein target (g) |
| carbs | REAL | DEFAULT 0 | Actual carbs (g) |
| carbsGoal | REAL | DEFAULT 240 | Carbs target (g) |
| fat | REAL | DEFAULT 0 | Actual fat (g) |
| fatGoal | REAL | DEFAULT 60 | Fat target (g) |
| fiber | REAL | DEFAULT 0 | Actual fiber (g) |
| fiberGoal | REAL | DEFAULT 30 | Fiber target (g) |
| steps | INTEGER | DEFAULT 0 | Step count |
| stepsGoal | INTEGER | DEFAULT 10000 | Step target |
| water | INTEGER | DEFAULT 0 | Water glasses |
| waterGoal | INTEGER | DEFAULT 8 | Water target |

#### **progress_snapshots**
Comprehensive progress measurements over time.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Snapshot ID |
| userId | INTEGER | FK → users.id, NOT NULL | User |
| recordDate | TIMESTAMP | NOT NULL | Measurement date |
| weight | REAL | - | Weight (kg) |
| bodyFat | REAL | - | Body fat percentage |
| muscleMass | REAL | - | Muscle mass (kg) |
| measurements | JSON | - | Body measurements object |
| photos | JSON | - | Array of uploaded_files IDs |
| notes | TEXT | - | Progress notes |
| createdAt | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

**Indexes:**
- userId + recordDate for timeline queries

---

## E-Commerce

#### **products**
Store products.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Product ID |
| name | TEXT | NOT NULL | Product name |
| description | TEXT | NOT NULL | Product description |
| price | REAL | NOT NULL | Price |
| imageUrl | TEXT | - | Product image |
| category | TEXT | NOT NULL | Product category |
| rating | REAL | - | Average rating |
| reviewCount | INTEGER | - | Number of reviews |
| stock | INTEGER | NOT NULL | Available stock |

#### **cart_items**
Shopping cart items.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Cart item ID |
| userId | INTEGER | FK → users.id, NOT NULL | User |
| productId | INTEGER | FK → products.id, NOT NULL | Product |
| quantity | INTEGER | NOT NULL, DEFAULT 1 | Quantity |
| createdAt | TIMESTAMP | DEFAULT NOW() | Added to cart date |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last updated |

**Unique Index:** (userId, productId) - one entry per user per product

#### **orders**
Customer orders.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Order ID |
| userId | INTEGER | FK → users.id, NOT NULL | Customer |
| status | TEXT | NOT NULL, DEFAULT 'pending' | pending, processing, shipped, delivered, cancelled |
| total | REAL | NOT NULL | Order total |
| currency | TEXT | NOT NULL, DEFAULT 'EGP' | Currency code |
| paymentMethod | TEXT | NOT NULL, DEFAULT 'card' | Payment method |
| paymentStatus | TEXT | NOT NULL, DEFAULT 'pending' | Payment status |
| shippingAddress | TEXT | - | Shipping address |
| shippingCity | TEXT | - | City |
| shippingCountry | TEXT | - | Country |
| shippingPhone | TEXT | - | Contact phone |
| notes | TEXT | - | Order notes |
| createdAt | TIMESTAMP | DEFAULT NOW() | Order date |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |
| completedAt | TIMESTAMP | - | Completion date |

#### **order_items**
Items within an order.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Order item ID |
| orderId | INTEGER | FK → orders.id, CASCADE | Parent order |
| productId | INTEGER | FK → products.id, NOT NULL | Product |
| productName | TEXT | NOT NULL | Product name snapshot |
| productPrice | REAL | NOT NULL | Price at purchase time |
| productImageUrl | TEXT | - | Image snapshot |
| quantity | INTEGER | NOT NULL, DEFAULT 1 | Quantity ordered |
| subtotal | REAL | NOT NULL | Subtotal (price × quantity) |

---

## Credit & Billing System

### Version 2 Credit System (Multi-Tenant)

#### **credit_accounts**
User credit accounts (multi-tenant aware).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Account ID |
| userId | INTEGER | FK → users.id, NOT NULL | User |
| tenantId | UUID | - | Tenant ID (for SaaS) |
| balance | INTEGER | NOT NULL, DEFAULT 0 | Current credit balance |
| lowBalanceThreshold | INTEGER | NOT NULL, DEFAULT 10 | Low balance alert threshold |
| createdAt | TIMESTAMP | DEFAULT NOW() | Account creation |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |

**Unique Index:** (userId, tenantId)

#### **credit_bundles**
Credit packages for purchase.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Bundle ID |
| tenantId | UUID | - | Tenant ID |
| name | TEXT | NOT NULL | Bundle name |
| credits | INTEGER | NOT NULL | Number of credits |
| priceCents | INTEGER | NOT NULL | Price in cents |
| currency | TEXT | NOT NULL, DEFAULT 'usd' | Currency code |
| isActive | BOOLEAN | NOT NULL, DEFAULT true | Active status |
| sortOrder | INTEGER | NOT NULL, DEFAULT 0 | Display order |
| createdAt | TIMESTAMP | DEFAULT NOW() | Creation date |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |

#### **credit_actions**
Credit deduction rules for actions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Action ID |
| tenantId | UUID | - | Tenant ID |
| actionKey | TEXT | NOT NULL | Action identifier |
| description | TEXT | - | Action description |
| cost | INTEGER | NOT NULL | Credit cost |
| isActive | BOOLEAN | NOT NULL, DEFAULT true | Active status |
| createdAt | TIMESTAMP | DEFAULT NOW() | Creation date |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |

**Unique Index:** (tenantId, actionKey)

#### **credit_transactions_v2**
Credit transaction ledger.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Transaction ID |
| creditAccountId | UUID | FK → credit_accounts.id, CASCADE | Account |
| tenantId | UUID | - | Tenant ID |
| userId | INTEGER | FK → users.id, CASCADE | User |
| type | TEXT | NOT NULL | purchase, deduction, refund, bonus,admin_adjustment |
| creditsDelta | INTEGER | NOT NULL | Credit change (+ or -) |
| balanceAfter | INTEGER | - | Balance after transaction |
| provider | TEXT | - | Payment provider (for purchases) |
| providerReference | TEXT | - | Provider transaction ID |
| checkoutSessionId | TEXT | - | Checkout session ID |
| bundleId | UUID | FK → credit_bundles.id | Bundle purchased |
| actionKey | TEXT | - | Action performed (for deductions) |
| metadata | JSON | - | Additional data |
| status | TEXT | NOT NULL, DEFAULT 'pending' | pending, completed, failed, refunded |
| createdAt | TIMESTAMP | DEFAULT NOW() | Transaction date |

**Indexes:**
- providerReference (unique)
- creditAccountId + createdAt
- checkoutSessionId
- actionKey

### Legacy Credit System

#### **credit_balances**
Legacy credit balance table.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| userId | INTEGER | PRIMARY KEY, FK → users.id | User |
| totalCredits | REAL | NOT NULL, DEFAULT 0 | Total credits |
| lastDeductionDate | TIMESTAMP | - | Last deduction |
| createdAt | TIMESTAMP | DEFAULT NOW() | Creation date |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |

#### **credit_transactions**
Legacy credit transactions (supports Geidea & Stripe).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Transaction ID |
| userId | INTEGER | FK → users.id, CASCADE | User |
| merchantReferenceId | TEXT | NOT NULL, UNIQUE | Merchant reference |
| sessionId | TEXT | UNIQUE | Payment session ID |
| orderId | TEXT | - | Order ID |
| paymentGateway | TEXT | NOT NULL, DEFAULT 'stripe' | Gateway used |
| status | TEXT | NOT NULL, DEFAULT 'pending' | Transaction status |
| gatewayStatus | TEXT | - | Gateway-specific status |
| responseCode | TEXT | - | Gateway response code |
| amount | REAL | NOT NULL | Amount paid |
| currency | TEXT | NOT NULL, DEFAULT 'EGP' | Currency |
| credits | INTEGER | NOT NULL | Credits purchased |
| checkoutUrl | TEXT | - | Payment page URL |
| requestPayload | JSON | - | Request data |
| sessionPayload | JSON | - | Session data |
| callbackPayload | JSON | - | Gateway callback data |
| signatureValid | BOOLEAN | DEFAULT false | Signature validation |
| credited | BOOLEAN | DEFAULT false | Credits issued |
| completedAt | TIMESTAMP | - | Completion date |
| createdAt | TIMESTAMP | DEFAULT NOW() | Transaction date |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |

---

## Coaching & Content

#### **coach_invitations**
User invitations to coaches.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Invitation ID |
| userId | INTEGER | FK → users.id, NOT NULL | User sending invitation |
| coachId | INTEGER | FK → users.id, NOT NULL | Coach receiving invitation |
| status | TEXT | NOT NULL, DEFAULT 'pending' | pending, accepted, declined |
| invitedAt | TIMESTAMP | DEFAULT NOW() | Invitation date |
| respondedAt | TIMESTAMP | - | Response date |
| userMessage | TEXT | - | Optional message from user |

#### **coach_info**
Coach profile information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Profile ID |
| coachId | INTEGER | FK → users.id, UNIQUE, NOT NULL | Coach user |
| aboutMe | TEXT | - | About section |
| qualifications | TEXT | - | Qualifications |
| certificateImages | TEXT[] | - | Certificate image URLs |
| trainingApproach | TEXT | - | Training philosophy |
| successStories | TEXT | - | Success stories |
| servicesAndPrograms | TEXT | - | Services offered |
| contact | TEXT | - | Contact information |
| createdAt | TIMESTAMP | DEFAULT NOW() | Profile creation |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |

#### **coach_products**
Coach's personal product recommendations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Product ID |
| coachId | INTEGER | FK → users.id, NOT NULL | Coach |
| title | TEXT | NOT NULL | Product title |
| url | TEXT | NOT NULL | Product URL |
| description | TEXT | - | Description |
| thumbnailUrl | TEXT | - | Thumbnail image |
| createdAt | TIMESTAMP | DEFAULT NOW() | Creation date |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |

#### **content_library**
Coach content management (videos, images).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Content ID |
| coachId | INTEGER | FK → users.id, NOT NULL | Coach owner |
| title | TEXT | NOT NULL | Content title |
| description | TEXT | - | Description |
| type | TEXT | NOT NULL | video or image |
| url | TEXT | NOT NULL | Media URL |
| thumbnailUrl | TEXT | - | Thumbnail URL |
| category | TEXT | NOT NULL | workout, exercise, nutrition, etc. |
| tags | TEXT[] | DEFAULT [] | Tags for filtering |
| duration | INTEGER | - | Video duration (seconds) |
| createdAt | TIMESTAMP | DEFAULT NOW() | Upload date |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |

#### **user_plans**
Coach-assigned plans for users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Plan ID |
| userId | INTEGER | FK → users.id, NOT NULL | Trainee |
| coachId | INTEGER | FK → users.id, NOT NULL | Coach |
| title | TEXT | NOT NULL | Plan title |
| description | TEXT | NOT NULL | Plan description |
| weeklyFocus | TEXT | - | Weekly focus area |
| goals | JSON | - | Goals object |
| weeklySchedule | JSON | - | Schedule object |
| createdAt | TIMESTAMP | DEFAULT NOW() | Plan creation |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |

---

## Affiliate & Marketing

#### **affiliate_products**
Admin-managed affiliate links.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Product ID |
| title | TEXT | NOT NULL | Product title |
| url | TEXT | NOT NULL | Affiliate URL |
| description | TEXT | - | Description |
| thumbnailUrl | TEXT | - | Thumbnail image |
| category | TEXT | - | supplements, equipment, apparel |
| source | TEXT | - | amazon, noon, etc. |
| isActive | BOOLEAN | DEFAULT true | Active status |
| lastScrapedAt | TIMESTAMP | - | Last scrape date |
| scrapeEnabled | BOOLEAN | DEFAULT true | Auto-scraping enabled |
| createdAt | TIMESTAMP | DEFAULT NOW() | Creation date |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |

#### **affiliate_categories**
Dynamic category management.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Category ID |
| nameEn | TEXT | NOT NULL, UNIQUE | English name |
| nameAr | TEXT | NOT NULL | Arabic name |
| slug | TEXT | NOT NULL, UNIQUE | URL slug |
| isActive | BOOLEAN | DEFAULT true, NOT NULL | Active status |
| displayOrder | INTEGER | DEFAULT 0, NOT NULL | Sort order |
| createdAt | TIMESTAMP | DEFAULT NOW() | Creation date |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |

#### **scraped_affiliate_products**
Products extracted from affiliate URLs.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Scraped product ID |
| affiliateProductId | INTEGER | FK → affiliate_products.id, CASCADE | Parent affiliate product |
| title | TEXT | NOT NULL | Product title |
| price | TEXT | - | Current price |
| originalPrice | TEXT | - | Original price |
| discount | TEXT | - | Discount info |
| rating | REAL | - | Product rating |
| reviewCount | INTEGER | - | Review count |
| imageUrl | TEXT | - | Product image |
| productUrl | TEXT | NOT NULL | Product page URL |
| availability | TEXT | - | Stock status |
| createdAt | TIMESTAMP | DEFAULT NOW() | Scrape date |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |

#### **product_clicks**
Track affiliate product clicks.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Click ID |
| userId | INTEGER | FK → users.id, CASCADE | User who clicked |
| affiliateProductId | INTEGER | FK → affiliate_products.id, CASCADE | Product clicked |
| clickedAt | TIMESTAMP | DEFAULT NOW() | Click timestamp |

#### **tracking_settings**
Global tracking & ads settings (single-row table).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Settings ID (always 1) |
| metaPixelId | TEXT | - | Meta Pixel ID |
| metaPixelAccessToken | TEXT | - | Meta Pixel access token |
| metaPixelTestEventCode | TEXT | - | Meta test event code |
| googleAdsConversionId | TEXT | - | Google Ads conversion ID |
| googleAdsConversionLabel | TEXT | - | Conversion label |
| googleAdsSendTo | TEXT | - | Send to parameter |
| googleAnalyticsMeasurementId | TEXT | - | GA4 measurement ID |
| googleAnalyticsApiSecret | TEXT | - | GA4 API secret |
| googleAnalyticsStreamId | TEXT | - | GA4 stream ID |
| googleAnalyticsPropertyId | TEXT | - | GA4 property ID |
| updatedByUserId | INTEGER | FK → users.id | Last updated by |
| createdAt | TIMESTAMP | DEFAULT NOW() | Creation date |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |

---

## Gamification

#### **user_points_and_streaks**
User gamification tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Record ID |
| userId | INTEGER | FK → users.id, UNIQUE, NOT NULL | User |
| totalPoints | INTEGER | NOT NULL, DEFAULT 0 | Total points earned |
| currentStreak | INTEGER | NOT NULL, DEFAULT 0 | Current streak days |
| longestStreak | INTEGER | NOT NULL, DEFAULT 0 | Longest streak |
| lastActivityDate | TIMESTAMP | - | Last activity |
| lastBreakfastLogDate | TIMESTAMP | - | Last breakfast log |
| lastLunchLogDate | TIMESTAMP | - | Last lunch log |
| lastDinnerLogDate | TIMESTAMP | - | Last dinner log |
| lastSnackLogDate | TIMESTAMP | - | Last snack log |
| snackLogsToday | INTEGER | NOT NULL, DEFAULT 0 | Snack logs today count |
| lastWorkoutLogDate | TIMESTAMP | - | Last workout log |
| lastWeightLogDate | TIMESTAMP | - | Last weight log |
| lastStorePurchaseDate | TIMESTAMP | - | Last store purchase |
| createdAt | TIMESTAMP | DEFAULT NOW() | Account creation |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |

#### **user_logins**
Login activity tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Login ID |
| userId | INTEGER | FK → users.id, NOT NULL | User |
| loginAt | TIMESTAMP | DEFAULT NOW() | Login timestamp |
| ipAddress | TEXT | - | IP address |
| userAgent | TEXT | - | User agent string |

#### **achievements**
User achievement milestones.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Achievement ID |
| userId | INTEGER | FK → users.id, CASCADE | User |
| achievementType | TEXT | NOT NULL | workout_streak, nutrition_adherence, weight_milestone, etc. |
| title | TEXT | NOT NULL | Achievement title |
| titleAr | TEXT | - | Arabic title |
| description | TEXT | - | Description |
| descriptionAr | TEXT | - | Arabic description |
| value | INTEGER | - | Numeric value (e.g., 7 for 7-day streak) |
| metadata | JSON | - | Additional context |
| achievedAt | TIMESTAMP | DEFAULT NOW() | Achievement date |
| notificationSent | BOOLEAN | DEFAULT false | Notification sent flag |

**Indexes:**
- userId for user achievements
- achievementType for filtering
- achievedAt for timeline

#### **referrals**
Referral tracking and rewards.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Referral ID |
| referrerId | INTEGER | FK → users.id, CASCADE | User who referred |
| referralCode | TEXT | NOT NULL, UNIQUE | Unique referral code |
| referralType | TEXT | NOT NULL, DEFAULT 'user' | user, coach, gym, partner |
| referredUserId | INTEGER | FK → users.id | Referred user |
| conversionStatus | TEXT | NOT NULL, DEFAULT 'pending' | pending, registered, plan_purchased, subscription_active, revenue_milestone |
| conversionDate | TIMESTAMP | - | Conversion date |
| revenueGenerated | REAL | DEFAULT 0 | Revenue from referral |
| commissionRate | REAL | DEFAULT 0 | Commission percentage |
| commissionAmount | REAL | DEFAULT 0 | Commission amount |
| commissionStatus | TEXT | DEFAULT 'pending' | pending, approved, paid, cancelled |
| commissionPaidAt | TIMESTAMP | - | Payment date |
| rewardType | TEXT | - | credits, discount, free_month, bonus_features, cash |
| rewardValue | REAL | - | Reward value |
| rewardIssued | BOOLEAN | DEFAULT false | Reward issued flag |
| rewardIssuedAt | TIMESTAMP | - | Reward issue date |
| rewardExpiresAt | TIMESTAMP | - | Reward expiration |
| isSuspicious | BOOLEAN | DEFAULT false | Fraud flag |
| fraudCheckNotes | TEXT | - | Fraud notes |
| createdAt | TIMESTAMP | DEFAULT NOW() | Referral creation |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |

---

## Supplements System

#### **supplements**
Supplement catalog.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Supplement ID |
| name | TEXT | NOT NULL | English name |
| nameAr | TEXT | - | Arabic name |
| forms | JSON | - | Array: capsule, powder, tablet, liquid |
| ingredients | TEXT | - | Ingredient list |
| dosageRangeMin | REAL | - | Min dosage |
| dosageRangeMax | REAL | - | Max dosage |
| dosageUnit | TEXT | - | mg, g, ml, IU, etc. |
| contraindications | TEXT | - | Contraindications |
| interactions | TEXT | - | Known interactions |
| warnings | TEXT | - | Warnings |
| categories | JSON | - | Array: protein, vitamins, minerals, pre-workout |
| evidenceNotes | TEXT | - | Evidence-based notes |
| references | TEXT | - | Scientific references |
| isGlobal | BOOLEAN | DEFAULT true, NOT NULL | Admin-curated vs coach-added |
| createdBy | INTEGER | FK → users.id | Creator |
| scopeCoachId | INTEGER | FK → users.id, CASCADE | Coach scope (if coach-specific) |
| createdAt | TIMESTAMP | DEFAULT NOW() | Creation date |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |

**Indexes:**
- name for search
- isGlobal for filtering
- createdBy for creator tracking

#### **supplement_recommendations**
Coach supplement prescriptions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Recommendation ID |
| userId | INTEGER | FK → users.id, CASCADE | User |
| supplementId | INTEGER | FK → supplements.id, CASCADE | Supplement |
| coachId | INTEGER | FK → users.id | Coach |
| dosageAmount | REAL | NOT NULL | Dosage amount |
| dosageUnit | TEXT | NOT NULL | Dosage unit |
| dosageFrequency | TEXT | NOT NULL | daily, twice_daily, with_each_meal |
| maxDailyLimit | REAL | - | Max daily dosage |
| isCustomDosage | BOOLEAN | DEFAULT false | Coach override flag |
| dosageRationale | TEXT | - | Dosage reasoning |
| coachNotes | TEXT | - | Coach notes |
| timingType | TEXT | - | morning, pre_workout, post_workout, with_meals, before_sleep |
| timingDetails | JSON | - | Detailed timing object |
| status | TEXT | DEFAULT 'active', NOT NULL | active, paused, completed, discontinued |
| startDate | TIMESTAMP | DEFAULT NOW() | Start date |
| endDate | TIMESTAMP | - | End date |
| warningsChecked | BOOLEAN | DEFAULT false | Warnings reviewed |
| warningsAcknowledged | BOOLEAN | DEFAULT false | Warnings accepted |
| createdAt | TIMESTAMP | DEFAULT NOW() | Recommendation date |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |

**Indexes:**
- userId for user supplements
- supplementId for supplement tracking
- coachId for coach recommendations
- status for active filtering

#### **supplement_interactions**
Interaction warnings database.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Interaction ID |
| supplementId | INTEGER | FK → supplements.id, CASCADE | Supplement |
| interactsWith | TEXT | NOT NULL | Other supplement, medication, condition |
| interactionType | TEXT | NOT NULL | supplement, medication, medical_condition, allergy |
| severity | TEXT | NOT NULL | mild, moderate, severe, critical |
| description | TEXT | NOT NULL | Interaction description |
| actionRequired | TEXT | DEFAULT 'warning', NOT NULL | warning, confirmation_required, hard_block |
| createdAt | TIMESTAMP | DEFAULT NOW() | Creation date |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |

**Indexes:**
- supplementId for lookups
- severity for filtering

#### **user_supplement_warnings**
User-specific warnings.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Warning ID |
| userId | INTEGER | FK → users.id, CASCADE | User |
| recommendationId | INTEGER | FK → supplement_recommendations.id, CASCADE | Recommendation |
| interactionId | INTEGER | FK → supplement_interactions.id | Interaction |
| severity | TEXT | NOT NULL | Severity level |
| warningMessage | TEXT | NOT NULL | Warning text |
| flaggedReason | TEXT | NOT NULL | Trigger details |
| status | TEXT | DEFAULT 'pending', NOT NULL | pending, acknowledged, resolved, overridden |
| acknowledgedBy | INTEGER | FK → users.id | Coach/admin who acknowledged |
| acknowledgedAt | TIMESTAMP | - | Acknowledgement date |
| resolutionNotes | TEXT | - | Resolution notes |
| createdAt | TIMESTAMP | DEFAULT NOW() | Warning date |

**Indexes:**
- userId
- recommendationId
- status
- severity

#### **supplement_reminders**
Supplement reminder settings.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Reminder ID |
| userId | INTEGER | FK → users.id, CASCADE | User |
| recommendationId | INTEGER | FK → supplement_recommendations.id, CASCADE | Recommendation |
| enabled | BOOLEAN | DEFAULT true, NOT NULL | Reminder enabled |
| reminderTimes | JSON | - | Array of HH:MM times |
| reminderDays | JSON | - | Array of day names |
| lastSentAt | TIMESTAMP | - | Last reminder sent |
| createdAt | TIMESTAMP | DEFAULT NOW() | Creation date |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |

**Indexes:**
- userId
- recommendationId
- enabled

#### **supplement_side_effects**
User-reported side effects.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Side effect ID |
| userId | INTEGER | FK → users.id, CASCADE | User |
| recommendationId | INTEGER | FK → supplement_recommendations.id, CASCADE | Recommendation |
| supplementId | INTEGER | FK → supplements.id | Supplement |
| severity | TEXT | NOT NULL | mild, moderate, severe, critical |
| symptoms | TEXT | NOT NULL | Symptom description |
| notes | TEXT | - | Additional notes |
| photo | TEXT | - | Photo URL |
| occurredAt | TIMESTAMP | NOT NULL | Occurrence date |
| resolvedAt | TIMESTAMP | - | Resolution date |
| status | TEXT | DEFAULT 'active', NOT NULL | active, resolved, escalated |
| escalatedTo | INTEGER | FK → users.id | Coach/admin |
| escalatedAt | TIMESTAMP | - | Escalation date |
| createdAt | TIMESTAMP | DEFAULT NOW() | Report date |

**Indexes:**
- userId
- recommendationId
- severity
- status

#### **supplement_effectiveness_ratings**
User effectiveness ratings.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Rating ID |
| userId | INTEGER | FK → users.id, CASCADE | User |
| recommendationId | INTEGER | FK → supplement_recommendations.id, CASCADE | Recommendation |
| supplementId | INTEGER | FK → supplements.id | Supplement |
| rating | INTEGER | NOT NULL | 1-5 scale |
| notes | TEXT | - | Rating notes |
| ratingPeriodStart | TIMESTAMP | - | Rating period start |
| ratingPeriodEnd | TIMESTAMP | - | Rating period end |
| createdAt | TIMESTAMP | DEFAULT NOW() | Rating date |

**Indexes:**
- userId
- recommendationId
- supplementId
- rating

---

## Notifications & Alerts

#### **notifications**
Unified notification system.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Notification ID |
| userId | INTEGER | FK → users.id, CASCADE | User |
| type | TEXT | NOT NULL | meal, workout, supplement, sleep, water, motivational, achievement |
| title | TEXT | NOT NULL | English title |
| titleAr | TEXT | - | Arabic title |
| message | TEXT | NOT NULL | English message |
| messageAr | TEXT | - | Arabic message |
| scheduledFor | TIMESTAMP | - | Scheduled delivery time |
| sentAt | TIMESTAMP | - | Sent timestamp |
| readAt | TIMESTAMP | - | Read timestamp |
| status | TEXT | DEFAULT 'pending', NOT NULL | pending, sent, read, dismissed |
| relatedEntityType | TEXT | - | recommendation, workout, meal, etc. |
| relatedEntityId | INTEGER | - | Related entity ID |
| metadata | JSON | - | Additional context |
| createdAt | TIMESTAMP | DEFAULT NOW() | Creation date |

**Indexes:**
- userId
- type
- status
- scheduledFor

#### **reminder_settings**
User reminder preferences.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Setting ID |
| userId | INTEGER | FK → users.id, CASCADE | User |
| reminderType | TEXT | NOT NULL | meal, workout, supplement, sleep, water |
| enabled | BOOLEAN | DEFAULT true, NOT NULL | Reminder enabled |
| times | JSON | - | Array of HH:MM times |
| days | JSON | - | Array of day names |
| customMessage | TEXT | - | Custom message (English) |
| customMessageAr | TEXT | - | Custom message (Arabic) |
| createdAt | TIMESTAMP | DEFAULT NOW() | Creation date |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |

**Unique Index:** (userId, reminderType)

**Indexes:**
- userId
- reminderType
- enabled

#### **motivational_templates**
Motivational message templates.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Template ID |
| trigger | TEXT | NOT NULL | streak_achieved, inactivity_detected, goal_milestone, workout_completed, nutrition_target_hit |
| title | TEXT | NOT NULL | English title |
| titleAr | TEXT | - | Arabic title |
| message | TEXT | NOT NULL | English message |
| messageAr | TEXT | - | Arabic message |
| isActive | BOOLEAN | DEFAULT true, NOT NULL | Active status |
| priority | INTEGER | DEFAULT 0 | Priority (higher = first) |
| minStreakDays | INTEGER | - | For streak_achieved |
| inactivityDays | INTEGER | - | For inactivity_detected |
| createdBy | INTEGER | FK → users.id | Creator |
| createdAt | TIMESTAMP | DEFAULT NOW() | Creation date |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |

**Indexes:**
- trigger
- isActive

#### **missed_workouts**
Missed workout tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Missed workout ID |
| userId | INTEGER | FK → users.id, CASCADE | User |
| scheduledDate | TIMESTAMP | NOT NULL | Scheduled date |
| workoutId | INTEGER | FK → workouts.id | Workout |
| notificationSent | BOOLEAN | DEFAULT false | User notification sent |
| coachNotified | BOOLEAN | DEFAULT false | Coach notification sent |
| createdAt | TIMESTAMP | DEFAULT NOW() | Record creation |

**Indexes:**
- userId
- scheduledDate

---

## Files & Reports

#### **uploaded_files**
File management system.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | File ID |
| userId | INTEGER | FK → users.id, CASCADE | Uploader |
| coachId | INTEGER | FK → users.id | Related coach |
| fileType | TEXT | NOT NULL | progress_photo, medical_report, pdf, excel, video |
| fileName | TEXT | NOT NULL | Original filename |
| fileUrl | TEXT | NOT NULL | Secure URL |
| fileSize | INTEGER | NOT NULL | Size in bytes |
| mimeType | TEXT | NOT NULL | MIME type |
| tags | JSON | - | Array of tags |
| description | TEXT | - | English description |
| descriptionAr | TEXT | - | Arabic description |
| visibility | TEXT | DEFAULT 'private', NOT NULL | private, coach_visible, admin_visible |
| uploadDate | TIMESTAMP | DEFAULT NOW() | Upload date |
| linkedEntityType | TEXT | - | workout, meal, progress_log, supplement |
| linkedEntityId | INTEGER | - | Linked entity ID |
| virusScanStatus | TEXT | DEFAULT 'pending' | pending, clean, infected, skipped |
| virusScanDate | TIMESTAMP | - | Scan date |
| createdAt | TIMESTAMP | DEFAULT NOW() | Creation date |

**Indexes:**
- userId
- coachId
- fileType
- visibility
- uploadDate

#### **reports**
Generated reports.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Report ID |
| userId | INTEGER | FK → users.id, CASCADE | User |
| reportType | TEXT | NOT NULL | weekly, monthly, custom |
| periodStart | TIMESTAMP | NOT NULL | Period start |
| periodEnd | TIMESTAMP | NOT NULL | Period end |
| generatedBy | INTEGER | FK → users.id | Generator (coach/admin) |
| reportData | JSON | NOT NULL | Report metrics as JSON |
| pdfUrl | TEXT | - | PDF export URL |
| createdAt | TIMESTAMP | DEFAULT NOW() | Generation date |

**Indexes:**
- userId
- reportType
- periodStart + periodEnd

---

## Courses & Education

#### **courses**
Course catalog.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Course ID |
| title | TEXT | NOT NULL | English title |
| titleAr | TEXT | - | Arabic title |
| description | TEXT | - | English description |
| descriptionAr | TEXT | - | Arabic description |
| category | TEXT | NOT NULL | fitness, nutrition, wellness, business |
| level | TEXT | NOT NULL | beginner, intermediate, advanced |
| duration | INTEGER | - | Estimated duration (hours) |
| thumbnailUrl | TEXT | - | Thumbnail image |
| previewVideoUrl | TEXT | - | Preview video |
| price | REAL | DEFAULT 0 | Course price |
| currency | TEXT | DEFAULT 'USD' | Currency |
| isFree | BOOLEAN | DEFAULT false | Free course flag |
| tags | JSON | DEFAULT [] | Tags array |
| instructorId | INTEGER | FK → users.id, CASCADE | Instructor |
| status | TEXT | DEFAULT 'draft', NOT NULL | draft, published, archived |
| featured | BOOLEAN | DEFAULT false | Featured flag |
| certificateEnabled | BOOLEAN | DEFAULT false | Certificate available |
| certificateTemplate | TEXT | - | Certificate template |
| enrollmentCount | INTEGER | DEFAULT 0 | Total enrollments |
| averageRating | REAL | DEFAULT 0 | Average rating |
| ratingCount | INTEGER | DEFAULT 0 | Rating count |
| publishedAt | TIMESTAMP | - | Publish date |
| createdAt | TIMESTAMP | DEFAULT NOW() | Creation date |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |

**Indexes:**
- category
- level
- status
- instructorId
- featured

#### **lessons**
Course lessons.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Lesson ID |
| courseId | INTEGER | FK → courses.id, CASCADE | Course |
| title | TEXT | NOT NULL | English title |
| titleAr | TEXT | - | Arabic title |
| description | TEXT | - | English description |
| descriptionAr | TEXT | - | Arabic description |
| content | TEXT | - | English content |
| contentAr | TEXT | - | Arabic content |
| orderIndex | INTEGER | DEFAULT 0, NOT NULL | Lesson order |
| type | TEXT | NOT NULL | video, article, quiz, assignment |
| duration | INTEGER | - | Duration (minutes) |
| videoUrl | TEXT | - | Video URL |
| attachments | JSON | DEFAULT [] | Attachment URLs array |
| quizData | JSON | - | Quiz questions/answers |
| isPreview | BOOLEAN | DEFAULT false | Free preview |
| status | TEXT | DEFAULT 'draft', NOT NULL | draft, published |
| createdAt | TIMESTAMP | DEFAULT NOW() | Creation date |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |

**Indexes:**
- courseId
- orderIndex
- type

#### **course_enrollments**
User course enrollments.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Enrollment ID |
| courseId | INTEGER | FK → courses.id, CASCADE | Course |
| userId | INTEGER | FK → users.id, CASCADE | User |
| progress | INTEGER | DEFAULT 0 | Progress percentage (0-100) |
| currentLessonId | INTEGER | FK → lessons.id | Current lesson |
| completed | BOOLEAN | DEFAULT false | Completion status |
| completedAt | TIMESTAMP | - | Completion date |
| certificateIssued | BOOLEAN | DEFAULT false | Certificate issued |
| certificateUrl | TEXT | - | Certificate URL |
| certificateIssuedAt | TIMESTAMP | - | Certificate issue date |
| enrolledAt | TIMESTAMP | DEFAULT NOW() | Enrollment date |
| lastAccessedAt | TIMESTAMP | - | Last access |

**Unique Index:** (courseId, userId)

**Indexes:**
- courseId
- userId

#### **lesson_progress**
Lesson progress tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Progress ID |
| enrollmentId | INTEGER | FK → course_enrollments.id, CASCADE | Enrollment |
| lessonId | INTEGER | FK → lessons.id, CASCADE | Lesson |
| userId | INTEGER | FK → users.id, CASCADE | User |
| completed | BOOLEAN | DEFAULT false | Completion status |
| timeSpent | INTEGER | DEFAULT 0 | Time in seconds |
| quizScore | INTEGER | - | Quiz score |
| quizAttempts | INTEGER | DEFAULT 0 | Quiz attempts |
| startedAt | TIMESTAMP | DEFAULT NOW() | Start date |
| completedAt | TIMESTAMP | - | Completion date |
| lastAccessedAt | TIMESTAMP | - | Last access |

**Unique Index:** (enrollmentId, lessonId)

**Indexes:**
- enrollmentId
- lessonId
- userId

#### **course_reviews**
Course reviews and ratings.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Review ID |
| courseId | INTEGER | FK → courses.id, CASCADE | Course |
| userId | INTEGER | FK → users.id, CASCADE | User |
| rating | INTEGER | NOT NULL | Rating (1-5) |
| review | TEXT | - | Review text |
| isApproved | BOOLEAN | DEFAULT true | Approval status |
| createdAt | TIMESTAMP | DEFAULT NOW() | Review date |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |

**Unique Index:** (courseId, userId)

**Indexes:**
- courseId
- userId

#### **course_certificates**
Certificate templates.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Certificate ID |
| courseId | INTEGER | FK → courses.id, CASCADE | Course |
| title | TEXT | NOT NULL | English title |
| titleAr | TEXT | - | Arabic title |
| description | TEXT | - | English description |
| descriptionAr | TEXT | - | Arabic description |
| templateUrl | TEXT | - | Template design URL |
| issueAutomatically | BOOLEAN | DEFAULT false | Auto-issue on completion |
| issueUponCompletion | BOOLEAN | DEFAULT true | Issue when course completed |
| createdAt | TIMESTAMP | DEFAULT NOW() | Creation date |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |

**Unique Index:** (courseId, title)

**Indexes:**
- courseId

#### **course_certificate_issuances**
Certificate issuance tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Issuance ID |
| certificateId | INTEGER | FK → course_certificates.id, CASCADE | Certificate |
| userId | INTEGER | FK → users.id, CASCADE | User |
| courseId | INTEGER | FK → courses.id, CASCADE | Course |
| issuedAt | TIMESTAMP | DEFAULT NOW() | Issue date |
| certificateUrl | TEXT | - | Generated certificate URL |
| notes | TEXT | - | Issuance notes |
| createdAt | TIMESTAMP | DEFAULT NOW() | Creation date |

**Unique Index:** (certificateId, userId)

**Indexes:**
- certificateId
- userId
- courseId

---

## AI Assistant

#### **ai_conversations**
AI conversation history.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Conversation ID |
| userId | INTEGER | FK → users.id, CASCADE | User |
| messageType | TEXT | NOT NULL | question, answer, guidance, error, escalation |
| messageText | TEXT | NOT NULL | Message content (English) |
| messageTextAr | TEXT | - | Message content (Arabic) |
| contextData | JSON | - | Context object |
| confidenceScore | REAL | - | AI confidence (0-1) |
| language | TEXT | DEFAULT 'en', NOT NULL | en or ar |
| createdAt | TIMESTAMP | DEFAULT NOW() | Message date |

**Indexes:**
- userId
- createdAt

#### **ai_insights**
AI-generated insights.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Insight ID |
| userId | INTEGER | FK → users.id, CASCADE | User |
| insightType | TEXT | NOT NULL | adherence_pattern, risk_prediction, progress_analysis, recommendation |
| title | TEXT | NOT NULL | English title |
| titleAr | TEXT | - | Arabic title |
| description | TEXT | NOT NULL | English description |
| descriptionAr | TEXT | - | Arabic description |
| keySignals | JSON | - | Array of signal objects |
| confidenceScore | REAL | NOT NULL | Confidence (0-1) |
| riskLevel | TEXT | - | low, moderate, high, critical |
| trend | TEXT | - | improving, stable, declining |
| language | TEXT | DEFAULT 'en', NOT NULL | en or ar |
| isActive | BOOLEAN | DEFAULT true | Active status |
| createdAt | TIMESTAMP | DEFAULT NOW() | Insight date |
| expiresAt | TIMESTAMP | - | Expiration date |

**Indexes:**
- userId
- insightType
- riskLevel
- isActive + createdAt

#### **ai_plan_suggestions**
AI plan recommendations (pending coach approval).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Suggestion ID |
| userId | INTEGER | FK → users.id, CASCADE | User |
| coachId | INTEGER | FK → users.id | Coach |
| insightId | INTEGER | FK → ai_insights.id | Related insight |
| suggestionType | TEXT | NOT NULL | workout_intensity, rest_days, calorie_target, macro_ratio, exercise_substitution, other |
| title | TEXT | NOT NULL | English title |
| titleAr | TEXT | - | Arabic title |
| rationale | TEXT | NOT NULL | English rationale |
| rationaleAr | TEXT | - | Arabic rationale |
| currentPlan | JSON | - | Current plan object |
| suggestedPlan | JSON | - | Suggested plan object |
| diffSummary | TEXT | - | English diff summary |
| diffSummaryAr | TEXT | - | Arabic diff summary |
| status | TEXT | DEFAULT 'pending', NOT NULL | pending, approved, rejected, applied |
| approvedBy | INTEGER | FK → users.id | Approver |
| approvedAt | TIMESTAMP | - | Approval date |
| appliedAt | TIMESTAMP | - | Application date |
| rejectionReason | TEXT | - | Rejection reason |
| createdAt | TIMESTAMP | DEFAULT NOW() | Suggestion date |

**Indexes:**
- userId
- coachId
- status
- status + createdAt (for pending queue)

#### **escalation_requests**
Unified escalation tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Escalation ID |
| userId | INTEGER | FK → users.id, CASCADE | User |
| escalationType | TEXT | NOT NULL | coach_handoff, admin_support, consultation_booking, medical_referral |
| triggerSource | TEXT | NOT NULL | side_effect, repeated_failure, user_request, risk_prediction, medical_concern, ai_assistant |
| priority | TEXT | DEFAULT 'medium', NOT NULL | low, medium, high, urgent |
| status | TEXT | DEFAULT 'pending', NOT NULL | pending, assigned, scheduled, in_progress, completed, cancelled |
| title | TEXT | NOT NULL | English title |
| titleAr | TEXT | - | Arabic title |
| description | TEXT | NOT NULL | English description |
| descriptionAr | TEXT | - | Arabic description |
| sideEffectId | INTEGER | FK → supplement_side_effects.id | Linked side effect |
| missedWorkoutId | INTEGER | FK → missed_workouts.id | Linked missed workout |
| insightId | INTEGER | FK → ai_insights.id | Linked insight |
| conversationId | INTEGER | FK → ai_conversations.id | Linked conversation |
| assignedTo | INTEGER | FK → users.id | Assignee |
| assignedAt | TIMESTAMP | - | Assignment date |
| scheduledAt | TIMESTAMP | - | Schedule date |
| resolvedBy | INTEGER | FK → users.id | Resolver |
| resolvedAt | TIMESTAMP | - | Resolution date |
| resolutionNotes | TEXT | - | Resolution notes |
| createdAt | TIMESTAMP | DEFAULT NOW() | Escalation date |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |

**Indexes:**
- userId
- assignedTo
- status
- priority + createdAt
- status + priority (for pending queue)
- escalationType

---

## Community & Social

#### **friendships**
User friendships.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Friendship ID |
| userId | INTEGER | FK → users.id, CASCADE | User |
| friendId | INTEGER | FK → users.id, CASCADE | Friend |
| status | TEXT | DEFAULT 'pending', NOT NULL | pending, accepted, rejected, blocked |
| createdAt | TIMESTAMP | DEFAULT NOW() | Request date |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Status update date |

**Indexes:**
- userId
- friendId
- status

#### **achievement_shares**
Shared achievements.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Share ID |
| userId | INTEGER | FK → users.id, CASCADE | User |
| achievementId | INTEGER | FK → achievements.id, CASCADE | Achievement |
| visibility | TEXT | DEFAULT 'friends_only', NOT NULL | private, friends_only, public |
| shareType | TEXT | DEFAULT 'general', NOT NULL | general, group, challenge |
| groupId | INTEGER | FK → groups.id | Group (if group share) |
| message | TEXT | - | English message |
| messageAr | TEXT | - | Arabic message |
| createdAt | TIMESTAMP | DEFAULT NOW() | Share date |

**Indexes:**
- userId
- achievementId
- visibility
- groupId

#### **groups**
Community groups.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Group ID |
| name | TEXT | NOT NULL | English name |
| nameAr | TEXT | - | Arabic name |
| description | TEXT | - | English description |
| descriptionAr | TEXT | - | Arabic description |
| goalType | TEXT | NOT NULL | weight_loss, muscle_gain, endurance, flexibility, general_fitness |
| groupType | TEXT | DEFAULT 'public', NOT NULL | public, private |
| ownerId | INTEGER | FK → users.id | Owner |
| maxMembers | INTEGER | - | Max members allowed |
| memberCount | INTEGER | DEFAULT 0 | Current member count |
| createdAt | TIMESTAMP | DEFAULT NOW() | Creation date |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |

**Indexes:**
- ownerId
- goalType
- groupType

#### **group_members**
Group membership.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Membership ID |
| groupId | INTEGER | FK → groups.id, CASCADE | Group |
| userId | INTEGER | FK → users.id, CASCADE | User |
| role | TEXT | DEFAULT 'member', NOT NULL | owner, moderator, member |
| status | TEXT | DEFAULT 'active', NOT NULL | pending, active, removed, banned |
| joinedAt | TIMESTAMP | DEFAULT NOW() | Join date |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Status update |

**Indexes:**
- groupId
- userId
- role
- status

#### **discussion_topics**
Group discussion topics.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Topic ID |
| groupId | INTEGER | FK → groups.id, CASCADE | Group |
| authorId | INTEGER | FK → users.id | Author |
| title | TEXT | NOT NULL | Topic title |
| content | TEXT | NOT NULL | Topic content |
| isPinned | BOOLEAN | DEFAULT false | Pinned status |
| status | TEXT | DEFAULT 'open', NOT NULL | open, closed, locked |
| replyCount | INTEGER | DEFAULT 0 | Reply count |
| createdAt | TIMESTAMP | DEFAULT NOW() | Creation date |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |

**Indexes:**
- groupId
- authorId
- status
- isPinned

#### **topic_replies**
Discussion replies.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Reply ID |
| topicId | INTEGER | FK → discussion_topics.id, CASCADE | Topic |
| authorId | INTEGER | FK → users.id | Author |
| parentReplyId | INTEGER | FK → topic_replies.id, CASCADE | Parent reply (for threading) |
| content | TEXT | NOT NULL | Reply content |
| createdAt | TIMESTAMP | DEFAULT NOW() | Reply date |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |

**Indexes:**
- topicId
- authorId
- parentReplyId

#### **group_challenges**
Group fitness challenges.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Challenge ID |
| name | TEXT | NOT NULL | English name |
| nameAr | TEXT | - | Arabic name |
| description | TEXT | - | English description |
| descriptionAr | TEXT | - | Arabic description |
| challengeType | TEXT | NOT NULL | workout_count, weight_loss, step_count, nutrition_adherence, custom |
| metricName | TEXT | NOT NULL | Metric name |
| targetValue | REAL | - | Target value |
| startDate | TIMESTAMP | NOT NULL | Challenge start |
| endDate | TIMESTAMP | NOT NULL | Challenge end |
| createdBy | INTEGER | FK → users.id | Creator |
| groupId | INTEGER | FK → groups.id, CASCADE | Group (optional) |
| isPublic | BOOLEAN | DEFAULT true | Public visibility |
| createdAt | TIMESTAMP | DEFAULT NOW() | Creation date |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |

**Indexes:**
- createdBy
- groupId
- startDate + endDate

#### **challenge_participants**
Challenge participants.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Participation ID |
| challengeId | INTEGER | FK → group_challenges.id, CASCADE | Challenge |
| userId | INTEGER | FK → users.id, CASCADE | User |
| currentValue | REAL | DEFAULT 0 | Current progress value |
| rank | INTEGER | - | Current rank |
| joinedAt | TIMESTAMP | DEFAULT NOW() | Join date |
| lastUpdated | TIMESTAMP | DEFAULT NOW() | Last progress update |

**Indexes:**
- challengeId
- userId
- rank

#### **encouragements**
Social reactions (likes, cheers, etc.).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Encouragement ID |
| userId | INTEGER | FK → users.id, CASCADE | User giving encouragement |
| targetType | TEXT | NOT NULL | achievement_share, challenge_progress, discussion_topic, topic_reply |
| targetId | INTEGER | NOT NULL | Target entity ID |
| reactionType | TEXT | DEFAULT 'like', NOT NULL | like, cheer, fire, celebrate, strong |
| createdAt | TIMESTAMP | DEFAULT NOW() | Reaction date |

**Indexes:**
- userId
- targetType + targetId

#### **content_reports**
Content moderation reports.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Report ID |
| reporterId | INTEGER | FK → users.id | Reporter |
| contentType | TEXT | NOT NULL | achievement_share, discussion_topic, topic_reply, user_profile |
| contentId | INTEGER | NOT NULL | Content ID |
| reportType | TEXT | NOT NULL | spam, harassment, inappropriate, fake_profile, other |
| reason | TEXT | NOT NULL | Report reason |
| status | TEXT | DEFAULT 'pending', NOT NULL | pending, under_review, resolved, dismissed |
| assignedTo | INTEGER | FK → users.id | Moderator assigned |
| resolutionNotes | TEXT | - | Resolution notes |
| createdAt | TIMESTAMP | DEFAULT NOW() | Report date |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |

**Indexes:**
- reporterId
- contentType + contentId
- status
- assignedTo

#### **workshops**
Group workshops/sessions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Workshop ID |
| groupId | INTEGER | FK → groups.id | Group (optional) |
| title | TEXT | NOT NULL | English title |
| titleAr | TEXT | - | Arabic title |
| description | TEXT | - | English description |
| descriptionAr | TEXT | - | Arabic description |
| instructorId | INTEGER | FK → users.id | Instructor |
| workshopType | TEXT | NOT NULL | nutrition, workout, mindset, supplement, general |
| scheduledAt | TIMESTAMP | NOT NULL | Scheduled time |
| durationMinutes | INTEGER | NOT NULL | Duration in minutes |
| maxAttendees | INTEGER | - | Max attendees |
| price | REAL | DEFAULT 0 | Workshop price |
| meetingLink | TEXT | - | Meeting URL |
| status | TEXT | DEFAULT 'scheduled', NOT NULL | scheduled, in_progress, completed, cancelled |
| attendeeCount | INTEGER | DEFAULT 0 | Current attendee count |
| createdAt | TIMESTAMP | DEFAULT NOW() | Creation date |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |

**Indexes:**
- groupId
- instructorId
- scheduledAt
- status

#### **workshop_attendees**
Workshop registration.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Attendee ID |
| workshopId | INTEGER | FK → workshops.id, CASCADE | Workshop |
| userId | INTEGER | FK → users.id, CASCADE | User |
| registrationStatus | TEXT | DEFAULT 'registered', NOT NULL | registered, attended, cancelled, no_show |
| registeredAt | TIMESTAMP | DEFAULT NOW() | Registration date |
| attendedAt | TIMESTAMP | - | Attendance timestamp |

**Indexes:**
- workshopId
- userId

---

## SEO & Settings

#### **seo_settings**
SEO configuration (central and tenant-scoped).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Settings ID |
| titleTemplate | TEXT | NOT NULL | Default title template |
| titleTemplateEn | TEXT | - | English title template |
| titleTemplateAr | TEXT | - | Arabic title template |
| metaDescription | TEXT | NOT NULL | Default meta description |
| metaDescriptionEn | TEXT | - | English meta description |
| metaDescriptionAr | TEXT | - | Arabic meta description |
| metaKeywordsEn | TEXT | - | English keywords |
| metaKeywordsAr | TEXT | - | Arabic keywords |
| metaAuthor | TEXT | - | Meta author |
| metaViewport | TEXT | - | Viewport meta |
| ogTitle | TEXT | - | Open Graph title |
| ogTitleEn | TEXT | - | OG English title |
| ogTitleAr | TEXT | - | OG Arabic title |
| ogDescription | TEXT | - | OG description |
| ogDescriptionEn | TEXT | - | OG English description |
| ogDescriptionAr | TEXT | - | OG Arabic description |
| ogImageUrl | TEXT | - | OG image URL |
| ogType | TEXT | - | OG type |
| ogSiteName | TEXT | - | OG site name |
| ogLocale | TEXT | - | OG locale |
| ogLocaleAlternates | JSON | DEFAULT [] | OG locale alternates array |
| twitterTitle | TEXT | - | Twitter title |
| twitterTitleEn | TEXT | - | Twitter English title |
| twitterTitleAr | TEXT | - | Twitter Arabic title |
| twitterDescription | TEXT | - | Twitter description |
| twitterDescriptionEn | TEXT | - | Twitter English description |
| twitterDescriptionAr | TEXT | - | Twitter Arabic description |
| twitterImageUrl | TEXT | - | Twitter image |
| twitterCardType | TEXT | - | Twitter card type |
| twitterSite | TEXT | - | Twitter site handle |
| twitterCreator | TEXT | - | Twitter creator handle |
| facebookTitleEn | TEXT | - | Facebook English title |
| facebookTitleAr | TEXT | - | Facebook Arabic title |
| facebookDescriptionEn | TEXT | - | Facebook English description |
| facebookDescriptionAr | TEXT | - | Facebook Arabic description |
| facebookImageUrl | TEXT | - | Facebook image |
| facebookUrl | TEXT | - | Facebook page URL |
| instagramTitleEn | TEXT | - | Instagram English title |
| instagramTitleAr | TEXT | - | Instagram Arabic title |
| instagramDescriptionEn | TEXT | - | Instagram English description |
| instagramDescriptionAr | TEXT | - | Instagram Arabic description |
| instagramImageUrl | TEXT | - | Instagram image |
| instagramUrl | TEXT | - | Instagram profile URL |
| xTitleEn | TEXT | - | X (Twitter) English title |
| xTitleAr | TEXT | - | X Arabic title |
| xDescriptionEn | TEXT | - | X English description |
| xDescriptionAr | TEXT | - | X Arabic description |
| xImageUrl | TEXT | - | X image |
| xUrl | TEXT | - | X profile URL |
| robotsIndex | BOOLEAN | DEFAULT true, NOT NULL | robots index |
| robotsFollow | BOOLEAN | DEFAULT true, NOT NULL | robots follow |
| canonicalBaseUrl | TEXT | - | Canonical base URL |
| hreflangMap | JSON | DEFAULT {} | hreflang mapping object |
| sitemapIncludes | JSON | DEFAULT [] | Sitemap includes array |
| sitemapExcludes | JSON | DEFAULT [] | Sitemap excludes array |
| createdAt | TIMESTAMP | DEFAULT NOW() | Creation date |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |

#### **content_items**
Educational content hub.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Content ID |
| type | TEXT | NOT NULL | article, video, faq, story |
| category | TEXT | NOT NULL | nutrition, workout, supplement, mindset, recovery, general |
| title | TEXT | NOT NULL | English title |
| titleAr | TEXT | - | Arabic title |
| description | TEXT | - | English description |
| descriptionAr | TEXT | - | Arabic description |
| content | TEXT | NOT NULL | English content |
| contentAr | TEXT | - | Arabic content |
| tags | JSON | DEFAULT [] | Tags array |
| authorId | INTEGER | FK → users.id, CASCADE | Author |
| coachId | INTEGER | FK → users.id | Related coach |
| groupId | INTEGER | FK → groups.id | Related group |
| status | TEXT | DEFAULT 'draft', NOT NULL | draft, published, archived |
| visibility | TEXT | DEFAULT 'public', NOT NULL | public, trainees_only, group_only, admin_only |
| featured | BOOLEAN | DEFAULT false | Featured flag |
| typeMetadata | JSON | DEFAULT {} | Type-specific metadata |
| viewCount | INTEGER | DEFAULT 0 | View count |
| averageRating | REAL | DEFAULT 0 | Average rating |
| ratingCount | INTEGER | DEFAULT 0 | Rating count |
| publishedAt | TIMESTAMP | - | Publish date |
| createdAt | TIMESTAMP | DEFAULT NOW() | Creation date |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |

**Indexes:**
- type
- category
- status
- visibility
- authorId
- coachId
- groupId
- featured

#### **content_ratings**
Content ratings.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Rating ID |
| contentId | INTEGER | FK → content_items.id, CASCADE | Content |
| userId | INTEGER | FK → users.id, CASCADE | User |
| rating | INTEGER | NOT NULL | Rating (1-5) |
| reviewText | TEXT | - | Review text |
| createdAt | TIMESTAMP | DEFAULT NOW() | Rating date |

**Unique Index:** (contentId, userId)

**Indexes:**
- contentId
- userId

#### **content_bookmarks**
Content bookmarks and progress.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Bookmark ID |
| contentId | INTEGER | FK → content_items.id, CASCADE | Content |
| userId | INTEGER | FK → users.id, CASCADE | User |
| progressPercent | INTEGER | DEFAULT 0 | Progress (0-100) |
| completed | BOOLEAN | DEFAULT false | Completion flag |
| notes | TEXT | - | User notes |
| createdAt | TIMESTAMP | DEFAULT NOW() | Bookmark date |
| updatedAt | TIMESTAMP | DEFAULT NOW() | Last update |

**Unique Index:** (contentId, userId)

**Indexes:**
- contentId
- userId

#### **messages**
Direct messaging between users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Message ID |
| senderId | INTEGER | FK → users.id, NOT NULL | Sender |
| receiverId | INTEGER | FK → users.id, NOT NULL | Receiver |
| content | TEXT | NOT NULL | Message content |
| sentAt | TIMESTAMP | DEFAULT NOW() | Sent timestamp |
| read | BOOLEAN | DEFAULT false | Read status |

**Indexes:**
- senderId
- receiverId
- sentAt
- read

---

## Entity Relationship Diagram

### Core Relationships

```
users (1) ──< (M) workouts [coachId]
users (1) ──< (M) user_workouts [userId]
users (1) ──< (M) workout_sessions [userId]
users (1) ──< (M) meals [userId]
users (1) ──< (M) progress [userId]
users (1) ──< (M) orders [userId]
users (1) ──< (M) cart_items [userId]
users (1) ──< (M) messages [senderId, receiverId]
users (1) ──< (M) coach_invitations [userId, coachId]
users (1) ──── (1) coach_info [coachId]
users (1) ──< (M) course_enrollments [userId]
users (1) ──< (M) supplement_recommendations [userId]
users (1) ──< (M) ai_conversations [userId]
users (1) ──< (M) credit_accounts [userId]

workouts (1) ──< (M) user_workouts [workoutId]
workouts (1) ──< (M) workout_sessions [workoutId]

orders (1) ──< (M) order_items [orderId]
products (1) ──< (M) order_items [productId]
products (1) ──< (M) cart_items [productId]

courses (1) ──< (M) lessons [courseId]
courses (1) ──< (M) course_enrollments [courseId]
courses (1) ──< (M) course_reviews [courseId]
courses (1) ──< (M) course_certificates [courseId]

course_enrollments (1) ──< (M) lesson_progress [enrollmentId]
lessons (1) ──< (M) lesson_progress [lessonId]

supplements (1) ──< (M) supplement_recommendations [supplementId]
supplement_recommendations (1) ──< (M) supplement_reminders [recommendationId]
supplement_recommendations (1) ──< (M) supplement_side_effects [recommendationId]

groups (1) ──< (M) group_members [groupId]
groups (1) ──< (M) discussion_topics [groupId]
groups (1) ──< (M) group_challenges [groupId]

discussion_topics (1) ──< (M) topic_replies [topicId]
group_challenges (1) ──< (M) challenge_participants [challengeId]

credit_accounts (1) ──< (M) credit_transactions_v2 [creditAccountId]
credit_bundles (1) ──< (M) credit_transactions_v2 [bundleId]
```

---

## Indexes & Performance Optimizations

### High-Traffic Query Patterns

#### User Dashboards
- `users.id` (Primary Key)
- `user_workouts.userId + scheduledFor`
- `meals.userId + date`
- `daily_stats.userId + date`
- `progress.userId + date`

#### Coach Views
- `users.coachId`
- `workouts.coachId`
- `user_workouts.userId`
- `supplement_recommendations.coachId`

#### E-Commerce
- `cart_items(userId, productId)` - UNIQUE INDEX
- `orders.userId + createdAt`
- `order_items.orderId`

#### Credits
- `credit_accounts(userId, tenantId)` - UNIQUE INDEX
- `credit_transactions_v2.creditAccountId + createdAt`
- `credit_transactions_v2.providerReference` - UNIQUE INDEX

#### Courses
- `course_enrollments(courseId, userId)` - UNIQUE INDEX
- `lesson_progress(enrollmentId, lessonId)` - UNIQUE INDEX
- `lessons.courseId + orderIndex`

#### Community
- `group_members.groupId + userId`
- `discussion_topics.groupId + createdAt`
- `challenge_participants.challengeId + rank`

#### AI & Notifications
- `ai_conversations.userId + createdAt`
- `notifications.userId + status + scheduledFor`
- `escalation_requests.status + priority + createdAt`

---

## Data Types Reference

| Drizzle Type | PostgreSQL Type | Description |
|--------------|-----------------|-------------|
| `serial()` | SERIAL | Auto-incrementing integer |
| `integer()` | INTEGER | 32-bit integer |
| `real()` | REAL | Floating-point number |
| `text()` | TEXT | Variable-length text |
| `boolean()` | BOOLEAN | True/false |
| `timestamp()` | TIMESTAMP | Date and time |
| `json()` | JSON | JSON data |
| `uuid()` | UUID | Universally unique identifier |

---

## Migration Strategy

The database uses Drizzle Kit for migrations:

```bash
# Generate migration
npm run db:generate

# Apply migration
npm run db:migrate

# Push schema changes
npm run db:push
```

Migration files are stored in:
- Central DB: `/migrations`
- Tenant DBs: `/saas/migrations/central` and `/saas/migrations/tenant`

---

## Backup & Maintenance

### Recommended Backup Strategy
- **Daily**: Full database backup
- **Hourly**: Incremental backup of critical tables (orders, credit_transactions, course_enrollments)
- **Real-time**: Transaction log shipping for disaster recovery

### Maintenance Windows
- **Index Rebuilding**: Weekly during low-traffic hours
- **VACUUM**: Automated daily
- **Statistics Update**: After bulk data loads

---

## Security Considerations

1. **Password Storage**: All passwords are hashed (never stored plain-text)
2. **Foreign Keys**: Enforce referential integrity
3. **Cascade Deletes**: User deletion cascades to owned data
4. **Soft Deletes**: Critical data uses status fields instead of hard deletes
5. **Audit Trails**: createdAt, updatedAt timestamps on all tables
6. **File Security**: uploaded_files includes virus scan status
7. **Multi-Tenancy**: tenant_id isolation in credit system

---

## Contact & Support

For database schema questions or migration support, contact:
- **Database Admin**: [Your Contact]
- **Development Team**: [Team Contact]

---

**Document Version**: 1.0  
**Last Updated**: February 10, 2026  
**Schema Version**: Latest (main branch)

