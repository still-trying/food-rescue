# 🍱 Food Rescue

> A live surplus-food listings board that connects surplus food with people nearby — helping reduce food waste through quick local rescue.

## 🌱 What is Food Rescue?

Food Rescue is a full-stack MVP designed to help restaurants, kitchens, stores, and individuals share surplus food before it goes to waste.

A user can post an available food listing with a pickup location, time window, quantity, description, and optional photo. Other authenticated users can view the listing and claim it.

The listing follows a simple lifecycle:

**Available → Claimed → Picked Up**

Listings whose pickup window has ended are automatically removed from the active Available feed.

The project focuses on making the core food-rescue workflow simple, fast, and reliable.

---

## ✨ Features

- 🔐 Email/password authentication
- 👤 User signup with name
- 🍱 Create surplus-food listings
- 📝 Food name and description
- 📦 Quantity information
- 📍 Pickup area
- 🕐 Pickup start and end time
- 📸 Food photo upload
- 🗂️ Available / Claimed / Picked Up sections
- 👤 My Listings section
- ⚡ Atomic food claiming
- ✅ Mark claimed food as picked up
- ⏰ Pickup-window expiration handling
- 💾 Persistent database storage
- 🔒 Row-Level Security with Supabase
- ☁️ Supabase Storage for food photos
- 🚀 Vercel deployment
- 📱 Responsive interface

---

# 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React |
| Build Tool | Vite |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Backend | Supabase |
| Database | PostgreSQL |
| Authentication | Supabase Auth |
| File Storage | Supabase Storage |
| Hosting | Vercel |
| Version Control | Git + GitHub |

---

# 🏗️ Architecture

Food Rescue does not require a separate Express, Node.js, or FastAPI backend.

The React application communicates directly with Supabase.

```text
                  ┌─────────────────────┐
                  │       Browser       │
                  │   React + Vite UI   │
                  └──────────┬──────────┘
                             │
                             ▼
                  ┌─────────────────────┐
                  │      Supabase       │
                  │                     │
                  │  PostgreSQL         │
                  │  Authentication     │
                  │  Storage            │
                  │  Row-Level Security │
                  └──────────┬──────────┘
                             │
                             ▼
                  ┌─────────────────────┐
                  │       Vercel        │
                  │  Production Hosting │
                  └─────────────────────┘
📊 Listing Lifecycle

Every food listing follows this lifecycle:

┌───────────┐
│ Available │
└─────┬─────┘
      │
      │ User claims food
      ▼
┌───────────┐
│  Claimed  │
└─────┬─────┘
      │
      │ Food collected
      ▼
┌────────────┐
│ Picked Up  │
└────────────┘

Each listing contains a pickup window so users know when the food can be collected.

Pickup expiration

The application uses the existing pickup_window_end field to determine whether an available listing has expired.

Available
    │
    │ pickup_window_end reached
    ▼
Removed from active Available feed

The database does not currently use a separate expired status.

This keeps the lifecycle simple while preventing expired available food from remaining claimable.

🗄️ Database

The core application uses a PostgreSQL listings table in Supabase.

Example structure:

create table public.listings (
  id uuid primary key default gen_random_uuid(),

  title text not null,

  description text,

  quantity text,

  photo_url text,

  location_text text not null,

  pickup_window_start timestamptz not null,

  pickup_window_end timestamptz not null,

  status text not null default 'available'
    check (
      status in (
        'available',
        'claimed',
        'picked_up'
      )
    ),

  posted_by uuid not null
    references auth.users(id),

  claimed_by uuid
    references auth.users(id),

  created_at timestamptz not null
    default now()
);

An index can be used to efficiently retrieve listings:

create index listings_status_created_idx
on public.listings (
  status,
  created_at desc
);
⚡ Atomic Claiming

One of the most important parts of Food Rescue is preventing two people from claiming the same food.

The application only allows a listing to be updated if its current status is available.

Example:

const { data, error } = await supabase
  .from('listings')
  .update({
    status: 'claimed',
    claimed_by: user.id,
  })
  .eq('id', listingId)
  .eq('status', 'available')
  .select()
  .maybeSingle()

The important condition is:

.eq('status', 'available')

If another user has already claimed the listing, the second request will not overwrite the existing claim.

This provides database-level protection against double claiming.

🔒 Security

Supabase Row-Level Security is used to control database access.

The application is designed so that:

Authenticated users can view food listings.
Users can create listings for themselves.
Users cannot impersonate another user when creating a listing.
Users can claim available food.
A listing cannot be claimed twice.
Only the user who claimed food can mark it as picked up.
Users cannot freely modify other users' listings.

Authentication is handled through Supabase Auth.

📸 Photo Upload

Food Rescue supports optional food photos.

Photos are stored in a Supabase Storage bucket:

listing-photos

The upload flow is:

User selects image
       ↓
React form
       ↓
Supabase Storage
       ↓
Public image URL
       ↓
listings.photo_url
       ↓
Listing Card

The photo itself is stored in Supabase Storage rather than inside PostgreSQL.

Only the image URL is stored in the listing record.

📋 My Listings

Food Rescue includes a My Listings view.

Users can view listings that they personally posted and track their current status.

My Listings
     │
     ├── Available
     ├── Claimed
     └── Picked Up

This gives contributors a simple way to track the food they have shared.

📁 Project Structure
food-rescue/
│
├── public/
│
├── src/
│   ├── assets/
│
│   ├── components/
│   │   ├── Auth.tsx
│   │   ├── ListingCard.tsx
│   │   ├── ListingFeed.tsx
│   │   └── PostListingForm.tsx
│
│   ├── lib/
│   │   └── supabase.ts
│
│   ├── App.tsx
│   ├── App.css
│   ├── index.css
│   └── main.tsx
│
├── .env
├── .gitignore
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
└── README.md
🚀 Getting Started
1. Clone the repository
git clone https://github.com/still-trying/food-rescue.git

Then:

cd food-rescue
2. Install dependencies
npm install
3. Configure environment variables

Create a .env file in the project root.

VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

Do not commit your .env file to GitHub.

The .gitignore should contain:

.env
.env.local
▶️ Run Locally

Start the development server:

npm run dev

The application will normally be available at:

http://localhost:5173
🏗️ Production Build

Before deploying, test the production build:

npm run build

If the build succeeds, preview it locally using:

npm run preview
⚙️ Supabase Setup

To reproduce the backend:

Step 1 — Create Supabase project

Create a new Supabase project.

Step 2 — Create database table

Create the listings table using the SQL schema described above.

Step 3 — Enable Row-Level Security

Enable RLS on the listings table.

Step 4 — Configure authentication

Enable email/password authentication.

For quick MVP testing, email confirmation can be disabled.

Step 5 — Create Storage bucket

Create:

listing-photos

The bucket can be configured for public image viewing.

Step 6 — Configure Storage policies

Allow authenticated users to upload listing photos.

🌐 Deployment

The production application is hosted using Vercel.

Deployment architecture:

GitHub
   │
   │ Push to main
   ▼
Vercel
   │
   │ Build
   ▼
React Production App
   │
   ▼
Supabase

The Vercel project requires these environment variables:

VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY

Every push to the main branch can trigger a new Vercel deployment.

🧪 End-to-End Test

A complete Food Rescue test should follow this workflow:

1. Create account
       ↓
2. Login
       ↓
3. Click "Post Surplus"
       ↓
4. Enter food information
       ↓
5. Add pickup location
       ↓
6. Add pickup window
       ↓
7. Upload optional photo
       ↓
8. Post food
       ↓
9. Listing appears under Available
       ↓
10. Another user claims it
       ↓
11. Listing moves to Claimed
       ↓
12. Claimant marks it as Picked Up
       ↓
13. Listing moves to Picked Up
Expiration Test

To test pickup expiration:

1. Create a listing
       ↓
2. Set pickup end time to the past
       ↓
3. Open Available
       ↓
4. Listing should not appear as active

This verifies the pickup-window expiration logic.

🎯 MVP Scope

Food Rescue intentionally focuses on the core food-rescue workflow.

Included
Authentication
User signup
User login
Logout
Food listings
Food descriptions
Quantity
Pickup location
Pickup time window
Food photos
Supabase Storage
Available listings
Claimed listings
Picked Up listings
My Listings
Atomic claiming
Pickup completion
Pickup-window expiration handling
PostgreSQL persistence
Supabase Auth
Row-Level Security
Vercel deployment
Responsive interface
Not included yet
GPS-based discovery
Maps
Chat
Push notifications
Ratings
Payments
Advanced recommendation system
Admin dashboard
Real-time notifications
Business verification
AI food classification

These features can be added in future versions.

🔮 Future Improvements

Possible future versions could include:

📍 Location-based discovery

Show surplus food based on distance from the user.

🗺️ Map integration

Display nearby food listings on a map.

⚡ Real-time updates

Use Supabase Realtime so listings update immediately when someone claims them.

🔔 Notifications

Notify users when:

New food becomes available
Their listing is claimed
Pickup time is approaching
A listing is about to expire
🏪 Business accounts

Allow restaurants, hotels, cafes, bakeries, grocery stores, and other organizations to create verified accounts.

📊 Impact dashboard

Track:

Meals rescued
Food listings
Successful pickups
Estimated food waste prevented
Active contributors
⭐ Community reputation

Add ratings and reliability scores for users and organizations.

🛡️ Listing moderation

Add reporting and moderation tools to handle:

Incorrect listings
Unsafe food
Spam
Inappropriate images
Fraudulent accounts
🧠 Smart matching

Eventually recommend listings based on:

Distance
Pickup time
Food type
User preferences
Availability
💡 Why Food Rescue?

A large amount of edible food is discarded because it becomes surplus before it can be consumed.

Food Rescue focuses on a simple idea:

Make surplus food visible to people who can use it before it becomes waste.

Instead of building a complicated marketplace, the MVP provides a simple local board:

Someone has extra food
        ↓
Post it
        ↓
Someone nearby sees it
        ↓
Claim it
        ↓
Pick it up
        ↓
Food is rescued
🤝 Contributing

Contributions and improvements are welcome.

Create a feature branch:

git checkout -b feature/your-feature

Make your changes:

git add .

Commit:

git commit -m "Add your feature"

Push:

git push origin feature/your-feature

Then create a Pull Request on GitHub.

📄 License

This project is currently developed as an MVP / innovation project.

MIT

💚 Mission

Food that can still be eaten should not become waste simply because it is surplus.

Food Rescue connects surplus food with people who can use it — quickly, locally, and simply.

Built with:

React + TypeScript + Tailwind CSS + Supabase + Vercel

🚧 Project Status

Food Rescue started as a rapid MVP and is now being developed beyond the initial hackathon version.

The current application supports the core rescue workflow:

Post
  ↓
Discover
  ↓
Claim
  ↓
Pick Up

The next stage is to evolve it into a more scalable local food-rescue platform with:

Better location discovery
Real-time updates
Notifications
Business accounts
Trust and safety
Impact tracking
Community features
🔗 Repository

GitHub:

https://github.com/still-trying/food-rescue
