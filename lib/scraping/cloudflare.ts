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
    // No credentials → go straight to native fetch fallback
    if (!this.apiToken || !this.accountId) {
      console.warn(`[CloudflareCrawler] No credentials configured, using native fetch for: ${url}`);
      return this.fallbackScrape(url);
    }

    const response = await fetch(`${this.baseUrl}/${this.accountId}/browser-rendering/crawl`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        limit: options.limit || 10,
        render: options.render !== undefined ? options.render : true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorJson;
      try {
        errorJson = JSON.parse(errorText);
      } catch (e) {}

      if (errorJson?.errors?.[0]?.code === 2001) {
        console.warn("Cloudflare Rate limit exceeded. Falling back to native fetch scraper...");
        return this.fallbackScrape(url);
      }

      throw new Error(`Cloudflare Crawl API error: ${errorText}`);
    }

    const data = await response.json();
    console.log("Cloudflare Start Crawl Response:", JSON.stringify(data, null, 2));
    
    // Cloudflare sometimes returns the ID directly in result, or as result.id
    if (data.result && typeof data.result === 'string') {
      return data.result;
    }
    
    if (data.result && data.result.id) {
      return data.result.id;
    }

    throw new Error(`Cloudflare did not return a valid job ID. Data: ${JSON.stringify(data)}`);
  }

  /**
   * Checks the status of a crawl job
   */
  async getCrawlStatus(jobId: string): Promise<CrawlJobResponse> {
    // Intercept our simulated fallback jobs
    if (jobId.startsWith('fallback-job-')) {
      const job = (global as any).__fallbackJobs?.[jobId];
      if (job) {
        delete (global as any).__fallbackJobs[jobId]; // evita memory leak
        return job;
      }
      throw new Error(`Fallback job ${jobId} not found in memory`);
    }

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

  /**
   * Native fetch fallback when Cloudflare rate limits are hit
   * This works reasonably well for simple SSR/static sites like Guadalajara Secreta
   * which don't strictly require Full Browser Rendering to read text content.
   */
  private async fallbackScrape(url: string): Promise<string> {
    try {
      console.log(`[CloudflareCrawler] Executing native fetch fallback for ${url}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'es-MX,es;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Referer': 'https://www.google.com/',
          'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Upgrade-Insecure-Requests': '1'
        },
        signal: controller.signal,
        redirect: 'follow'
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Fallback fetch failed with status ${response.status}`);
      }
      
      const html = await response.text();
      
      // Store it in a simulated "completed" job response in memory
      // We return a special internal ID to bypass normal polling
      const simulatedJobId = `fallback-job-${Date.now()}`;
      
      // Store globally for the getCrawlStatus to pick up
      (global as any).__fallbackJobs = (global as any).__fallbackJobs || {};
      (global as any).__fallbackJobs[simulatedJobId] = {
        id: simulatedJobId,
        status: 'completed',
        result: {
          pages: [{
            url: url,
            content: html,
            status: response.status
          }]
        }
      };
      
      return simulatedJobId;
    } catch (e: any) {
      throw new Error(`Límite de Cloudflare excedido y Fetch nativo falló: ${e.message}`);
    }
  }
}
