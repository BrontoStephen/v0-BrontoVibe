'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Copy, Check } from 'lucide-react';
import { useCustomFeatures } from '@/lib/custom-features-context';
import { Button } from '@/components/ui/button';

const FEATURE_PROMPTS: Record<string, string> = {
  'Executive Dashboard': `Build an executive dashboard page that shows high-level KPIs using the Bronto search API.

Include:
1. A summary row of cards: Total Events (count(*)), Error Rate (percentage of severity=5 vs total), and Average Latency (avg(response_time_ms)) — all for the selected time range.
2. A timeseries area chart showing event volume over time using select: ["count(*)"], num_of_slices: 30, time_range from the time picker.
3. A top-5 bar chart of busiest datasets using groups: ["$l"], select: ["count(*)"], limit: 5.
4. A top errors table using where: "severity = 5", groups: ["message"], select: ["count(*)"], limit: 10.

Use the existing search() function from @/lib/bronto-api and fetch dataset names via fetchLogs(). Add a time range picker in the header slot. All data should auto-refresh when the time range changes.`,

  'Error Rate by Service': `Build a page that visualizes error rates broken down by dataset/service using the Bronto search API.

Include:
1. Two queries per time range: total count via select: ["count(*)"], groups: ["$l"] and error count via select: ["count(*)"], groups: ["$l"], where: "severity = 5".
2. Compute error rate percentage per dataset in the UI (errors / total * 100).
3. Show a horizontal bar chart sorted by error rate, with bars colored red (>10%), yellow (5-10%), green (<5%).
4. Below the chart, show a table with columns: Dataset, Total Events, Errors, Error Rate %.
5. Add a time range picker in the header slot.

Use the existing search() function from @/lib/bronto-api and fetchLogs() for dataset names.`,

  'Top Error Messages': `Build a page that shows the most frequent error messages across all datasets using the Bronto search API.

Include:
1. A search query with: from (all dataset IDs from fetchLogs()), select: ["count(*)"], where: "severity = 5", groups: ["message"], limit: 20.
2. Display results as a top-list with horizontal bars showing relative frequency.
3. Each row should show the error message (truncated with tooltip for full text) and the count.
4. Add a click handler on each row that navigates to the Search page with the message pre-filled as a filter.
5. Add a time range picker in the header slot.

Use the existing search() function from @/lib/bronto-api and fetchLogs() for dataset IDs.`,

  'Status Code Breakdown': `Build a page that shows HTTP status code distribution across all datasets using the Bronto search API.

Include:
1. A search query with: from (all dataset IDs), select: ["count(*)"], groups: ["status_code"] or groups: ["http.status_code"].
2. A donut/pie chart showing the distribution of status codes grouped by category (2xx, 3xx, 4xx, 5xx).
3. Below the chart, a table with columns: Status Code, Count, Percentage.
4. Color-code: 2xx green, 3xx blue, 4xx yellow, 5xx red.
5. Add a time range picker in the header slot.

Use the existing search() function from @/lib/bronto-api and fetchLogs() for dataset IDs.`,

  'Request Volume Over Time': `Build a page that shows request volume trends over time using the Bronto search API.

Include:
1. A timeseries chart using select: ["count(*)"], num_of_slices: 60, with the time range from a picker.
2. Allow grouping by dataset using groups: ["$l"] with a toggle to enable/disable grouping.
3. Show a stacked area chart when grouped, and a simple line chart when ungrouped.
4. Below the chart, show summary cards: Total Requests, Peak Rate (max count in a time slice), Average Rate.
5. Add a time range picker and a group-by toggle in the header slot.

Use the existing search() function from @/lib/bronto-api and fetchLogs() for dataset IDs.`,

  'Slowest API Endpoints': `Build a page that shows the slowest API endpoints using the Bronto search API.

Include:
1. A search query with: from (all dataset IDs), select: ["avg(response_time_ms)", "max(response_time_ms)", "count(*)"], groups: ["endpoint"] or groups: ["http.target"], limit: 20.
2. A horizontal bar chart sorted by average response time (slowest first).
3. A table below with columns: Endpoint, Avg Latency, Max Latency, Request Count.
4. Color-code latency: green (<100ms), yellow (100-500ms), red (>500ms).
5. Add a time range picker in the header slot.

Use the existing search() function from @/lib/bronto-api and fetchLogs() for dataset IDs.`,
};

function getPromptForFeature(name: string): string {
  if (FEATURE_PROMPTS[name]) return FEATURE_PROMPTS[name];
  const lower = name.toLowerCase();
  for (const [key, prompt] of Object.entries(FEATURE_PROMPTS)) {
    if (key.toLowerCase() === lower) return prompt;
  }
  return `Build a "${name}" feature page using the Bronto search API.

Use the existing search() function from @/lib/bronto-api with appropriate select, groups, where, and time_range parameters. Use fetchLogs() to get available dataset IDs. Add a time range picker in the header slot. Display results using charts and/or tables as appropriate for the data.`;
}

export default function CustomFeaturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { features } = useCustomFeatures();
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const feature = features.find((f) => f.id === id);

  useEffect(() => {
    if (id && !feature) {
      router.replace('/');
    }
  }, [id, feature, router]);

  const prompt = feature ? getPromptForFeature(feature.name) : '';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-1 items-center justify-center h-full">
      <div className="flex flex-col items-center gap-4 max-w-2xl text-center px-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <Sparkles className="h-4 w-4 text-primary/60" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">
          {feature?.name || 'Your canvas awaits'}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Copy the prompt below and send it to v0 to build this feature.
        </p>
        <div className="w-full mt-2 rounded-lg border border-border bg-muted/30 text-left relative group">
          <div className="absolute top-2 right-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <pre className="p-4 pr-10 text-xs text-foreground/80 whitespace-pre-wrap font-mono leading-relaxed max-h-[400px] overflow-y-auto">
            {prompt}
          </pre>
        </div>
        <p className="text-[11px] text-muted-foreground/60">
          Click the copy button, then paste into the v0 chat
        </p>
      </div>
    </div>
  );
}
