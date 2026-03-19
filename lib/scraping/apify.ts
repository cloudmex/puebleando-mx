
/**
 * Apify Crawler Service
 * Interacts with Apify API to run specialized social media actors
 */

export interface ApifyJobResponse {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: {
    pages: Array<{
      url: string;
      content: string; // We will store the JSON stringified here to keep consistent with Orchestrator
      status: number;
    }>;
  };
  error?: string;
}

export class ApifyCrawler {
  private apiToken: string;
  private baseUrl: string = 'https://api.apify.com/v2';

  constructor() {
    this.apiToken = process.env.APIFY_API_TOKEN || '';
    if (!this.apiToken) {
      console.warn('APIFY_API_TOKEN missing in environment variables.');
    }
  }

  /**
   * Identifies the best Apify actor for a given URL
   */
  private getActorForUrl(url: string): string {
    if (url.includes('facebook.com')) {
      return 'apify/facebook-events-scraper';
    }
    if (url.includes('instagram.com')) {
      return 'apify/instagram-scraper';
    }
    if (url.includes('tiktok.com')) {
      return 'apify/tiktok-scraper';
    }
    // Fallback or generic web scraper if needed, but we usually use Cloudflare for that
    return 'apify/web-scraper';
  }

  /**
   * Starts a new Apify actor run
   */
  async startCrawl(url: string): Promise<string> {
    if (!this.apiToken) throw new Error('APIFY_API_TOKEN not configured');

    const actorId = this.getActorForUrl(url).replace('/', '~');
    console.log(`[ApifyCrawler] Starting run for ${url} using actor ${actorId}`);

    // Configuration for the specific actor
    let input: any = {
      startUrls: [{ url }],
    };

    // Specific tweaks for Facebook Events
    if (actorId.includes('facebook-events-scraper')) {
      input = {
        ...input,
        scrapePastEvents: false,
        maxEvents: 20,
      };
    }

    const response = await fetch(`${this.baseUrl}/acts/${actorId}/runs?token=${this.apiToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Apify Start Run error: ${errorText}`);
    }

    const { data } = await response.json();
    return data.id;
  }

  /**
   * Polls for completion and gets results
   */
  async waitForCompletion(runId: string, timeoutMs: number = 600000): Promise<ApifyJobResponse> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const response = await fetch(`${this.baseUrl}/actor-runs/${runId}?token=${this.apiToken}`);
      if (!response.ok) {
        throw new Error(`Apify Get Status error: ${await response.text()}`);
      }

      const { data } = await response.json();
      
      if (data.status === 'SUCCEEDED') {
        // Fetch results from the dataset
        const datasetId = data.defaultDatasetId;
        const resultsResponse = await fetch(`${this.baseUrl}/datasets/${datasetId}/items?token=${this.apiToken}`);
        const items = await resultsResponse.json();

        return {
          id: runId,
          status: 'completed',
          result: {
            pages: [{
              url: 'apify://dataset/' + datasetId,
              content: JSON.stringify(items), // Send as JSON string for LLM to parse
              status: 200
            }]
          }
        };
      }

      if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(data.status)) {
        return {
          id: runId,
          status: 'failed',
          error: `Apify run ended with status: ${data.status}`
        };
      }

      // Wait 5 seconds before next poll
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    throw new Error(`Apify run ${runId} timed out`);
  }
}
