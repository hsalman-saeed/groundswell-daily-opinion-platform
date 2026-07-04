# Groundswell

A global daily opinion platform that scores players on how accurately they predict how people different from themselves will vote.

[![Next.js 15](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Vercel](https://img.shields.io/badge/Vercel-Platform-000000?style=flat-square&logo=vercel)](https://vercel.com/)
[![Amazon DynamoDB](https://img.shields.io/badge/Amazon%20DynamoDB-Database-232F3E?style=flat-square&logo=amazondynamodb)](https://aws.amazon.com/dynamodb/)
[![Amazon Aurora DSQL](https://img.shields.io/badge/Amazon%20Aurora%20DSQL-Database-232F3E?style=flat-square&logo=amazon)](https://aws.amazon.com/rds/aurora/)
[![Amazon Bedrock](https://img.shields.io/badge/Amazon%20Bedrock-AI-FF9900?style=flat-square&logo=amazon)](https://aws.amazon.com/bedrock/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Built for H0 Hackathon](https://img.shields.io/badge/Built%20for-H0%20Hackathon-blue?style=flat-square)](https://h0.devpost.com/)

Every day, one opinion question is released on Groundswell. Everyone worldwide answers it. However, the game is not about whether your opinion matches the majority; instead, it is about whether you can accurately predict how different countries and age groups responded. Your Empathy Score reflects your understanding of how contexts outside your own shape people's perspectives.

---

## Live Demo

*   **Production Deployment:** [https://groundswell-daily-opinion-platform.vercel.app](https://groundswell-daily-opinion-platform.vercel.app)
*   **Admin Panel:** [https://groundswell-daily-opinion-platform.vercel.app/admin](https://groundswell-daily-opinion-platform.vercel.app/admin) (Requires signing in with one of the accounts below to view question controls).

### Test Credentials

You can sign in using any of the following pre-seeded developer/player accounts (all accounts share the same password):

*   **Password:** `groundswell2026`
*   **Developer/Admin Account:** `hafiz@demo.com`
*   **Player Account (Germany):** `sofia@demo.com`
*   **Player Account (South Korea):** `kim@demo.com`
*   **Player Account (Mexico):** `alejandro@demo.com`
*   **Player Account (India):** `priya@demo.com`

---

## Architecture

This project uses a hybrid database architecture that leverages two AWS databases provisioned through the Vercel Marketplace, each selected for its alignment with a distinct data access pattern. The choices were made because the performance characteristics and constraints of the application's workloads are incompatible with a single database system.

<img width="1546" height="1017" alt="groundwell architecture" src="https://github.com/user-attachments/assets/b47c3089-4037-481b-abc8-500f1fe82b22" />


### Amazon DynamoDB — Vote Ingestion

Groundswell stores individual vote receipts and real-time demographic segment counters in a single DynamoDB table. The table utilizes a single-table design with prefix-based partition keys:

1.  **Vote Item:** `PK: VOTE#<questionId>`, `SK: PLAYER#<playerId>` (Stores the player's vote to prevent double voting).
2.  **Counter Item:** `PK: COUNTER#<questionId>`, `SK: SEG#<segmentValue>` (e.g., `SEG#country_DE`, `SEG#age_18-24`; stores atomic `yes_count` and `no_count` attributes).

During peak hours when voting traffic spikes, thousands of players submit opinions simultaneously. In a relational database, incrementing counters requires row-level locking, causing concurrent transactions to wait and leading to query queue latency. DynamoDB resolves this by providing lock-free updates at scale via `UpdateItem` with an `ADD` operation on numeric attributes.

To prevent players from submitting multiple votes, Groundswell uses a conditional write on the vote item type. If two requests arrive from the same player simultaneously, the database rejects the second write before the application consumes computation cycles.


### Amazon Aurora DSQL — Aggregates and Rankings

While DynamoDB handles write throughput, relational query workloads are directed to Amazon Aurora DSQL. DSQL manages structured relational tables covering player profiles, questions, computed global aggregates, predictions, and round results.

Computing the global leaderboard rankings requires ranking players dynamically by multiple parameters. We execute this using SQL window functions.

Doing this in a NoSQL database would require scanning all player records and sorting them in application memory, which becomes inefficient as the player base grows. Similarly, the nightly scoring pipeline joins the `user_predictions` table with the `question_aggregates` table to calculate absolute error scores for all players in a single SQL operation.

Using Aurora DSQL over standard PostgreSQL read replicas ensures globally consistent reads. In standard PostgreSQL architectures, read replicas can lag several seconds behind the primary write database. A player loading the daily result grid in Tokyo could see different statistics than a player in Berlin. Aurora DSQL's active-active multi-region deployment guarantees that all readers across regions access the same state immediately.

### The Midnight Pipeline

At midnight UTC, a scheduled Vercel Cron job triggers the database handoff. The pipeline reads the segment counters from DynamoDB, calculates the final demographic percentages, and writes them to Aurora DSQL's `question_aggregates` table. It then executes a batch JOIN in Aurora DSQL to score all player predictions for that day, updates player empathy scores, adjusts streaks, and marks the question as finalized.

### Amazon Bedrock — AI Question Generation

Daily opinion questions are generated using Amazon Bedrock's Nova Lite model (`us.amazon.nova-lite-v1:0`). A specialized prompt directs the model to formulate question candidates designed to reveal cultural or demographic divergence. The model returns five candidate questions, each with a predicted divergence score. Admins review and approve a candidate from the admin dashboard before it goes live.

---

## Features

*   **Daily Opinion Questions:** A new cultural or social topic is released every 24 hours for global voting.
*   **Demographic Prediction Sliders:** Players submit predictions on how other demographic groups (e.g., age buckets or specific countries) will vote before results are revealed.
*   **Empathy Score Metric:** A dynamic metric that ranks players based on their prediction accuracy rather than their alignment with the majority opinion.
*   **Live Result Grid:** Interactive charts displaying demographic vote distributions, pulling real-time statistics directly from DynamoDB counters.
*   **Global Leaderboard:** Rankings calculated using SQL window functions over historical scores.
*   **Personal Stats Profiles:** Analysis of player accuracy across different demographics, highlighting predicted segments and blind spots.
*   **AI Question Generator:** Integration with Amazon Bedrock to generate balanced question candidates with human-in-the-loop admin approval.
*   **Nightly Scoring Pipeline:** A scheduled midnight UTC CRON job that aggregates votes, calculates actual percentages, and updates player scores.

---

## Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | Next.js 15 App Router, React, Tailwind CSS | UI routing, responsive layouts, and interactive slide inputs |
| **Deployment** | Vercel Edge Network | Low-latency delivery of static assets and edge functions |
| **Database 1** | Amazon DynamoDB via Vercel Marketplace | Lock-free vote ingestion and real-time demographic counters |
| **Database 2** | Amazon Aurora DSQL via Vercel Marketplace | Globally consistent relational store for players, rankings, and predictions |
| **AI Ingestion** | Amazon Bedrock Nova Lite | Nightly generation of culturally divergent question candidates |
| **Authentication**| NextAuth v5, JWT Sessions | Authentication with secure session tokens |
| **Language** | TypeScript | Type safety across frontend, database drivers, and scoring algorithms |

---

## Project Structure

*   `app/` — Next.js 15 App Router pages and API endpoints.
    *   `app/page.tsx` — Homepage handling the active voting, prediction, and result states.
    *   `app/leaderboard/` — Global rankings page.
    *   `app/stats/` — Player profile statistics showing predictions history and accuracy breakdown.
    *   `app/admin/` — Admin panel for triggering Amazon Bedrock generation and managing questions.
    *   `app/api/today/` — API retrieving the current day's active question and player vote status.
    *   `app/api/votes/` — API for submitting votes with DynamoDB counter updates.
    *   `app/api/predictions/` — API for storing player demographic predictions.
    *   `app/api/results/` — API retrieving live, dynamic counters from DynamoDB.
    *   `app/api/leaderboard/` — API calculating player rankings with SQL window functions.
    *   `app/api/stats/` — API pulling player history and demographic accuracy profiles.
    *   `app/api/admin/` — API executing Bedrock prompt generation and question approval.
    *   `app/api/cron/` — Cron endpoint triggering the nightly scoring and aggregation pipeline.
*   `lib/` — Database clients and shared utilities.
    *   `lib/db/dsql.ts` — Aurora DSQL connection client utilizing the `@aws-sdk/dsql-signer` OIDC auth flow.
    *   `lib/db/dynamo.ts` — DynamoDB document client handling the single-table schema.
    *   `lib/bedrock.ts` — Bedrock runtime connection client.
    *   `lib/finalize-question.ts` — Core batch scoring and aggregate calculation logic.


---

## Getting Started

### Prerequisites

To run this project locally, you will need:
*   Node.js 18 or higher installed on your system.
*   `pnpm` package manager.
*   A Vercel account linked to an AWS integration with DynamoDB and Aurora DSQL.
*   Vercel CLI installed globally.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/hsalman-saeed/groundswell-daily-opinion-platform.git
    cd groundswell-daily-opinion-platform
    ```

2.  **Install project dependencies:**
    ```bash
    pnpm install
    ```

3.  **Install Vercel CLI globally:**
    ```bash
    npm install -g vercel
    ```

4.  **Link to your Vercel project:**
    ```bash
    vercel link
    ```
    Select your team and project scope.

5.  **Pull environment variables:**
    ```bash
    vercel env pull .env.local
    ```

6.  **Configure NextAuth variables:**
    Open the generated `.env.local` file and append:
    ```env
    NEXTAUTH_URL="http://localhost:3000"
    NEXTAUTH_SECRET="your-nextauth-secret-key-here"
    ```

7.  **Configure Bedrock credentials:**
    Append your personal AWS credentials (where Bedrock access is configured) to `.env.local`:
    ```env
    BEDROCK_ACCESS_KEY_ID="your-personal-aws-access-key"
    BEDROCK_SECRET_ACCESS_KEY="your-personal-aws-secret-key"
    BEDROCK_REGION="us-east-1"
    ```

8.  **Start the local development server:**
    ```bash
    vercel dev
    ```

9.  **Initialize the database schema and seed data:**
    With `vercel dev` running, open your browser and navigate to:
    [http://localhost:3000/api/setup/run-all](http://localhost:3000/api/setup/run-all)
    This will execute the migration scripts to initialize the Aurora DSQL tables, set up the DynamoDB table counters, and seed initial demo data.

10. **Open the application:**
    Visit [http://localhost:3000](http://localhost:3000) and sign in using `hafiz@demo.com` and password `groundswell2026`.

> [!WARNING]
> **Important Run Contexts:**
> *   **Do not use `npm run dev` or `pnpm dev`.** The AWS databases require a Vercel-generated OIDC token for connection authentication. This token is only injected into the runtime environment when running the server via the Vercel CLI with `vercel dev`.
> *   **Refresh environment variables periodically.** The Vercel OIDC token expires every 12 hours. If you receive credential validation errors, run `vercel env pull .env.local` again to fetch an active token.
> *   **Bedrock Authentication:** Bedrock calls use the static credentials `BEDROCK_ACCESS_KEY_ID` and `BEDROCK_SECRET_ACCESS_KEY`. They do not use the Vercel integration's managed OIDC role.

---

## Environment Variables

The application relies on the following environment variables:

| Variable | Source | Purpose |
| :--- | :--- | :--- |
| **`PGHOST`** | Vercel Marketplace (Aurora DSQL) | Endpoint for the Aurora DSQL cluster |
| **`PGUSER`** | Vercel Marketplace | Database connection username (defaults to `admin`) |
| **`PGDATABASE`** | Vercel Marketplace | Target database name (defaults to `postgres`) |
| **`PGPORT`** | Vercel Marketplace | Port for PostgreSQL-compatible queries (`5432`) |
| **`DSQL_AWS_ROLE_ARN`**| Vercel Marketplace | IAM Role used to authenticate Aurora DSQL connections |
| **`AWS_ROLE_ARN`** | Vercel Marketplace | IAM Role used to authenticate DynamoDB client operations |
| **`AWS_REGION`** | Vercel Marketplace | Target AWS region containing the resources |
| **`DYNAMODB_TABLE_NAME`**| Vercel Marketplace | Name of the provisioned single-table DynamoDB resource |
| **`VERCEL_OIDC_TOKEN`** | Auto-injected (Runtime / `vercel dev`) | Secure identity token used to assume target IAM Roles |
| **`BEDROCK_ACCESS_KEY_ID`**| Set Manually (Personal AWS Account) | Access key ID for Amazon Bedrock API calls |
| **`BEDROCK_SECRET_ACCESS_KEY`**| Set Manually (Personal AWS Account) | Secret access key for Amazon Bedrock API calls |
| **`BEDROCK_REGION`** | Set Manually | Region for Bedrock calls (`us-east-1`) |
| **`NEXTAUTH_SECRET`** | Set Manually | Key used to encrypt NextAuth session cookies |
| **`NEXTAUTH_URL`** | Set Manually | Public base URL of the site for auth callbacks |

---

## Database Schema

### Aurora DSQL Relational Schema

1.  **`players`**: Manages user credentials, demographic attributes, streaks, and aggregated scoring statistics.
    *   `player_id` (UUID, Primary Key)
    *   `username` (VARCHAR)
    *   `email` (VARCHAR, Unique)
    *   `password_hash` (VARCHAR)
    *   `country_code`, `country_name`, `age_bucket` (Demographic identifiers)
    *   `current_streak`, `longest_streak` (Streaks tracking)
    *   `total_questions_answered`, `total_empathy_score`, `avg_empathy_score`, `avg_prediction_error` (Leaderboard indexing metrics)
2.  **`questions`**: Stores daily opinion topics generated by Bedrock or created manually.
    *   `question_id` (UUID, Primary Key)
    *   `question_text` (TEXT)
    *   `category` (VARCHAR)
    *   `release_date` (DATE)
    *   `global_yes_pct`, `global_no_pct`, `global_abstain_pct` (Calculated voting totals)
    *   `divergence_score` (Calculated demographic variance)
    *   `bedrock_predicted_divergence` (Predicted variance from Bedrock model metadata)
    *   `total_participants` (Total votes counted)
    *   `is_final` (Flag indicating calculation completion)
3.  **`question_aggregates`**: Stores calculated yes/no/abstain percentages for each demographic segment once the voting window closes.
    *   `aggregate_id` (UUID, Primary Key)
    *   `question_id` (UUID, Foreign Key mapping)
    *   `segment_type` (VARCHAR; e.g., `country` or `age_group`)
    *   `segment_value` (VARCHAR; e.g., `DE` or `18-24`)
    *   `yes_pct`, `no_pct`, `abstain_pct` (Calculated percentages)
    *   `total_votes` (Total votes in segment)
4.  **`user_predictions`**: Records player prediction submissions containing their slider values.
    *   `prediction_id` (UUID, Primary Key)
    *   `player_id` (UUID, Foreign Key mapping)
    *   `question_id` (UUID, Foreign Key mapping)
    *   `target_segment_type`, `target_segment_value` (Segment being guessed)
    *   `predicted_yes_pct` (Player's prediction)
    *   `actual_yes_pct` (Final percentage recorded at midnight)
    *   `error_points` (Calculated absolute difference)
5.  **`user_question_results`**: Historical ledger storing the final score, empathy points, and average error achieved by each player on specific questions.
    *   `result_id` (UUID, Primary Key)
    *   `player_id`, `question_id` (Foreign Key mappings)
    *   `vote` (VARCHAR; player's own cast vote)
    *   `empathy_score` (Earned points)
    *   `avg_prediction_error` (Average prediction deviation)

### DynamoDB Single-Table Layout

All real-time vote transactions and demographic counts are directed to the Vercel-managed DynamoDB table:

| Partition Key (PK) | Sort Key (SK) | Attributes | Purpose |
| :--- | :--- | :--- | :--- |
| `VOTE#<questionId>` | `PLAYER#<playerId>` | `vote` (string), `country_code` (string), `age_bucket` (string), `voted_at` (string) | Individual vote receipt. Enforces one vote per player via conditional write. |
| `COUNTER#<questionId>` | `SEG#<segmentValue>` | `yes_count` (number), `no_count` (number) | Atomic counter increments (`UpdateItem` with `ADD`) for segments (e.g. `SEG#country_DE` or `SEG#age_18-24`). |

---

## Built for H0 Hackathon

This project was built for the **H0: Hack the Zero Stack hackathon** hosted by AWS and Vercel under **Track 3: Million-Scale Global App**. The architecture demonstrates how serverless databases can be combined within a single application to resolve conflicting write-throughput and relational-analytics requirements.

The central database design coordinates DynamoDB and Aurora DSQL: DynamoDB atomic counters buffer rapid write spikes during active voting windows, while Aurora DSQL handles structured queries, joins, and consistent read operations. A scheduled daily migration pipeline transfers transaction data to update player rankings, separating write throughput from query complexity.

---

## License

This project is licensed under the MIT License. See the LICENSE file for details.
