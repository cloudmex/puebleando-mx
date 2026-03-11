/**
 * Cloudflare Crawler Service
 * Interacts with Cloudflare Browser Rendering /crawl endpoint
 */

export interface CrawlJobResponse {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: {
    pages: Array<{
      url: string;
      content: string; // HTML, Markdown or JSON depending on format
      status: number;
    }>;
  };
  error?: string;
}

export class CloudflareCrawler {
  private apiToken: string;
  private accountId: string;
  private baseUrl: string = 'https://api.cloudflare.com/client/v4/accounts';

  constructor() {
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN || '';
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';

    if (!this.apiToken || !this.accountId) {
      console.warn('Cloudflare credentials missing in environment variables.');
    }
  }

  /**
   * Starts a new crawl job
   */
  async startCrawl(url: string, options: {
    maxDepth?: number;
    limit?: number;
    format?: 'html' | 'markdown' | 'json';
    render?: boolean;
  } = {}): Promise<string> {
    const response = await fetch(`${this.baseUrl}/${this.accountId}/browser-rendering/crawl`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        maxDepth: options.maxDepth || 1,
        limit: options.limit || 10,
        resultFormat: options.format || 'html',
        render: options.render !== undefined ? options.render : true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cloudflare Crawl API error: ${error}`);
    }

    const data = await response.json();
    return data.result.id;
  }

  /**
   * Checks the status of a crawl job
   */
  async getCrawlStatus(jobId: string): Promise<CrawlJobResponse> {
    const response = await fetch(`${this.baseUrl}/${this.accountId}/browser-rendering/crawl/${jobId}`, {
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cloudflare Crawl Status API error: ${error}`);
    }

    const data = await response.json();
    return data.result;
  }

  /**
   * Polls for crawl completion
   */
  async waitForCompletion(jobId: string, intervalMs: number = 5000, timeoutMs: number = 300000): Promise<CrawlJobResponse> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const res = await this.getCrawlStatus(jobId);
      if (res.status === 'completed' || res.status === 'failed') {
        return res;
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    throw new Error(`Crawl job ${jobId} timed out after ${timeoutMs}ms`);
  }
}
