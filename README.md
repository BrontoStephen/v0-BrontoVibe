# BrontoVibe

A modern log exploration and observability dashboard for [Bronto](https://bronto.io), built with Next.js 15 and designed for the Vercel platform.

![BrontoVibe Dashboard](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript) ![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?style=flat-square&logo=tailwindcss)

## Features

- **Log Search** - Full-text search across your Bronto datasets with histogram visualization
- **Trace Explorer** - Distributed tracing with waterfall view and span inspection
- **Dashboards** - Customizable dashboard layouts with multiple widget types
- **Usage Analytics** - Monitor ingestion and search usage across datasets
- **Dark Mode** - Full dark/light theme support
- **Custom Features** - Create saved searches with custom icons

## Getting Started

### Prerequisites

- A [Bronto](https://bronto.io) account with an API key
- Node.js 18+ and pnpm

### Local Development

```bash
# Install dependencies
pnpm install

# Run the development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and enter your Bronto API key to get started.

### Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FBrontoStephen%2FBrontoVibe)

## Fork & Customize with v0

Want to build your own custom Bronto UI? This project is designed to be forked and customized using [v0](https://v0.dev):

1. **Fork this repository** on GitHub
2. **Open in v0** - Go to [v0.dev](https://v0.dev) and connect your forked repo
3. **Vibecode** - Use AI-assisted development to customize your observability dashboard
4. **Deploy** - One-click deploy to Vercel

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org) (App Router)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)
- **Charts**: [Recharts](https://recharts.org)
- **Data Fetching**: [TanStack Query](https://tanstack.com/query)
- **Database Ready**: [Supabase](https://supabase.com) integration included

## Project Structure

```
app/
├── page.tsx              # Log search (home)
├── traces/page.tsx       # Trace explorer
├── dashboards/page.tsx   # Custom dashboards
├── usage/page.tsx        # Usage analytics
└── my-features/[id]/     # Custom saved features

components/
├── layout/               # App shell, sidebar, header
├── search/               # Search controls, filters
├── events/               # Log table, event details
├── traces/               # Trace visualization
├── charts/               # Histogram, charts
└── dashboards/           # Dashboard widgets

lib/
├── bronto-api.ts         # Bronto API client
├── bronto-types.ts       # TypeScript definitions
└── trace-utils.ts        # Trace processing utilities
```

## API Key

Your Bronto API key is stored in browser session storage and never sent to any server other than the Bronto API. You can clear it anytime from the sidebar settings.

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## License

MIT License - feel free to use this as a starting point for your own observability tools.

---

Built with [v0](https://v0.dev) on the [Vercel](https://vercel.com) platform.
