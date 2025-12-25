# ⚙️ AssetVerse Server (Backend)

The robust backend API service for **AssetVerse** - A Corporate Asset Management System. Built with **Node.js**, **Express.js**, and **MongoDB (Native Driver)**, featuring secure authentication with **JWT** and payment processing with **Stripe**.

---

## 🔗 Live URL

- **Base URL:** [https://asset-verse-client-psi.vercel.app/]
- **Client Repo:** [https://github.com/sunnyonweb/asset-verse-client.git]

---

## 🛠️ Technology Stack

- **Runtime:** [Node.js](https://nodejs.org/)
- **Framework:** [Express.js](https://expressjs.com/)
- **Database:** [MongoDB](https://www.mongodb.com/) (Native Driver)
- **Authentication:** [JsonWebToken](https://jwt.io/) (HttpOnly Cookies)
- **Payment:** [Stripe](https://stripe.com/)
- **Deployment:** [Vercel](https://vercel.com/)

---

## 🔑 Key Features

- **Secure Authentication:** JWT-based stateless authentication using HttpOnly cookies.
- **Role-Based Access Control (RBAC):** Middleware (`verifyToken`, `verifyHR`) to protect routes for HR Managers and Employees.
- **RESTful API Architecture:** Clean and organized endpoints for Assets, Users, Requests, and Payments.
- **Search, Filter & Pagination:** Advanced MongoDB queries for fetching asset lists efficiently.
- **Aggregation Pipelines:** Complex data aggregation for Dashboard Analytics (Charts).
- **Payment Intent:** Secure handling of Stripe payment intents for package upgrades.

---

## 🚀 Environment Variables

To run this project locally, you will need to add the following environment variables to your `.env` file:

```env
# Database Configuration
DB_URI=mongodb+srv://<username>:<password>@cluster0.xyz.mongodb.net/?retryWrites=true&w=majority

# JWT Secrets (Secure Random Strings)
ACCESS_TOKEN_SECRET=your_super_secret_access_token_key

# Payment Gateway
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key

# Environment
NODE_ENV=development
```
