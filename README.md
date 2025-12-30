# Imagen 4 Thumbnail API

Railway-hosted microservice for AI-powered product thumbnail generation using Google's Imagen 4 model.

## Features

- **Product Analysis**: Uses Gemini to analyze product cutouts for optimal background generation
- **Imagen 4 Integration**: Three model tiers (Fast/Standard/Ultra) for different quality/speed tradeoffs
- **2K Resolution Support**: Generate high-resolution backgrounds up to 2048x2048
- **Supabase Authentication**: Secure JWT-based authentication

## Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/health` | Health check | No |
| GET | `/api` | API information | No |
| POST | `/api/analyze-product` | Analyze product cutout | Yes |
| POST | `/api/generate-thumbnail` | Generate backgrounds | Yes |

## Imagen 4 Model Tiers

| Tier | Model ID | Rate Limit | Best For |
|------|----------|------------|----------|
| FAST | `imagen-4.0-fast-generate-001` | 150 req/min | Quick previews |
| STANDARD | `imagen-4.0-generate-001` | 75 req/min | Production use |
| ULTRA | `imagen-4.0-ultra-generate-001` | 30 req/min | Final renders |

## Setup

### Prerequisites

- Node.js 20+
- Google Cloud project with Vertex AI enabled
- Supabase project (for authentication)

### Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/imagen-thumbnail-api.git
cd imagen-thumbnail-api

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### Configuration

Edit `.env` with your credentials:

```env
# Google Cloud
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json

# Supabase (for JWT verification)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_JWT_SECRET=your-jwt-secret

# Server
PORT=3001
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000
```

### Google Cloud Setup

1. Enable the Vertex AI API in your GCP project
2. Create a service account with Vertex AI User role
3. Download the JSON key and save as `service-account.json`

### Running Locally

```bash
# Development mode (with hot reload)
npm run dev

# Production build
npm run build
npm start
```

## API Usage

### Analyze Product

```bash
curl -X POST http://localhost:3001/api/analyze-product \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cutoutBase64": "base64-encoded-image...",
    "productDescription": "Protein supplement bottle"
  }'
```

### Generate Thumbnail

```bash
curl -X POST http://localhost:3001/api/generate-thumbnail \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cutoutBase64": "base64-encoded-image...",
    "analysis": { ... },
    "industryPrompt": "fitness supplements",
    "variations": 2,
    "aspectRatio": "16:9",
    "modelTier": "STANDARD",
    "imageSize": "1K"
  }'
```

## Railway Deployment

1. Push to GitHub
2. Create new project in Railway
3. Connect GitHub repo
4. Add environment variables in Railway dashboard
5. Deploy!

## License

MIT
