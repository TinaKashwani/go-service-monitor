import { expect, test, type Page, type Route } from '@playwright/test';

type ServiceStatus = {
  name?: string;
  url: string;
  status: 'up' | 'down';
  status_code: number;
  response_time: number;
  response_time_ms: number;
  checked_at: string;
  error?: string;
};

const apiPath = '**/api/v1/services/status';

test.describe('service monitor dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());

      if (url.hostname !== '127.0.0.1') {
        await route.abort();
        throw new Error(`Unexpected external request: ${url.toString()}`);
      }

      await route.continue();
    });
  });

  test('loads the dashboard and renders healthy and unhealthy services', async ({ page }) => {
    await mockStatusResponses(page, [
      [
        {
          name: 'Healthy API',
          url: 'https://healthy.example.com',
          status: 'up',
          status_code: 200,
          response_time: 24000000,
          response_time_ms: 24,
          checked_at: '2026-01-15T12:30:00Z'
        },
        {
          url: 'https://offline.example.com',
          status: 'down',
          status_code: 503,
          response_time: 91000000,
          response_time_ms: 91,
          checked_at: '2026-01-15T12:30:00Z',
          error: 'timeout'
        }
      ]
    ]);

    await page.goto('/');

    await expect(page.getByTestId('results-grid')).toBeVisible();
    await expect(page.getByTestId('result-card')).toHaveCount(2);
    await expect(page.getByText('https://healthy.example.com')).toBeVisible();
    await expect(page.getByText('Healthy API')).toBeVisible();
    await expect(page.getByText('https://offline.example.com')).toBeVisible();
    await expect(page.getByText('Up')).toBeVisible();
    await expect(page.getByText('Down')).toBeVisible();
    await expect(page.getByText('24 ms')).toBeVisible();
    await expect(page.getByText('91 ms')).toBeVisible();
    await expect(page.getByText('200')).toBeVisible();
    await expect(page.getByText('503')).toBeVisible();
    await expect(page.getByText('Jan 15, 2026, 12:30:00 PM')).toHaveCount(2);
    await expect(page.getByText('timeout')).toBeVisible();
    await expect(page.getByTestId('services-count')).toHaveText('2');
    await expect(page.getByTestId('healthy-count')).toHaveText('1');
    await expect(page.getByTestId('unhealthy-count')).toHaveText('1');
  });

  test('shows a loading state before the API responds', async ({ page }) => {
    let releaseResponse!: () => void;
    const responseReleased = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });

    await page.route(apiPath, async (route) => {
      await responseReleased;
      await fulfillJson(route, []);
    });

    await page.goto('/');

    await expect(page.getByTestId('loading-state')).toBeVisible();

    releaseResponse();

    await expect(page.getByTestId('empty-state')).toBeVisible();
  });

  test('shows an empty state when the API returns no services', async ({ page }) => {
    await mockStatusResponses(page, [[]]);

    await page.goto('/');

    await expect(page.getByTestId('empty-state')).toBeVisible();
    await expect(page.getByText('No services configured')).toBeVisible();
  });

  test('shows an error state when the backend fails', async ({ page }) => {
    await page.route(apiPath, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'server error' })
      });
    });

    await page.goto('/');

    await expect(page.getByTestId('error-state')).toBeVisible();
    await expect(page.getByText('The backend returned HTTP 500.')).toBeVisible();
  });

  test('refreshes the dashboard with updated controlled data', async ({ page }) => {
    await mockStatusResponses(page, [
      [
        {
          url: 'https://before-refresh.example.com',
          status: 'up',
          status_code: 200,
          response_time: 18000000,
          response_time_ms: 18,
          checked_at: '2026-01-15T12:30:00Z'
        }
      ],
      [
        {
          url: 'https://after-refresh.example.com',
          status: 'down',
          status_code: 503,
          response_time: 97000000,
          response_time_ms: 97,
          checked_at: '2026-01-15T12:35:00Z',
          error: 'service unavailable'
        }
      ]
    ]);

    await page.goto('/');

    await expect(page.getByText('https://before-refresh.example.com')).toBeVisible();

    await page.getByTestId('refresh-button').click();

    await expect(page.getByText('https://after-refresh.example.com')).toBeVisible();
    await expect(page.getByText('97 ms')).toBeVisible();
    await expect(page.getByText('service unavailable')).toBeVisible();
    await expect(page.getByText('https://before-refresh.example.com')).not.toBeVisible();
  });

  test('keeps the dashboard usable on mobile layouts', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'This scenario is only relevant for the mobile project.');

    await mockStatusResponses(page, [
      [
        {
          url: 'https://mobile.example.com',
          status: 'up',
          status_code: 200,
          response_time: 33000000,
          response_time_ms: 33,
          checked_at: '2026-01-15T12:30:00Z'
        },
        {
          url: 'https://mobile-down.example.com',
          status: 'down',
          status_code: 502,
          response_time: 104000000,
          response_time_ms: 104,
          checked_at: '2026-01-15T12:30:00Z',
          error: 'bad gateway'
        }
      ]
    ]);

    await page.goto('/');

    await expect(page.getByTestId('refresh-button')).toBeVisible();
    await expect(page.getByTestId('result-card')).toHaveCount(2);
    await expect(page.getByText('33 ms')).toBeVisible();
    await expect(page.getByText('104 ms')).toBeVisible();

    const buttonBox = await page.getByTestId('refresh-button').boundingBox();
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );

    expect(buttonBox).not.toBeNull();
    expect(buttonBox!.width).toBeGreaterThan(250);
    expect(hasHorizontalOverflow).toBe(false);
  });

  test('keeps the desktop layout visible without collapsing the refresh button', async ({ page, isMobile }) => {
    test.skip(isMobile, 'This scenario is only relevant for the desktop project.');

    await mockStatusResponses(page, [
      [
        {
          url: 'https://desktop.example.com',
          status: 'up',
          status_code: 200,
          response_time: 41000000,
          response_time_ms: 41,
          checked_at: '2026-01-15T12:30:00Z'
        }
      ]
    ]);

    await page.goto('/');

    const buttonBox = await page.getByTestId('refresh-button').boundingBox();
    const viewportWidth = page.viewportSize()?.width ?? 0;

    expect(buttonBox).not.toBeNull();
    expect(buttonBox!.width).toBeLessThan(viewportWidth / 2);
    await expect(page.getByTestId('result-card')).toHaveCount(1);
  });
});

async function mockStatusResponses(
  page: Page,
  responses: ServiceStatus[][]
): Promise<void> {
  let index = 0;

  await page.route(apiPath, async (route) => {
    const response = responses[Math.min(index, responses.length - 1)];
    index += 1;

    await fulfillJson(route, response);
  });
}

async function fulfillJson(
  route: Route,
  response: ServiceStatus[]
): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(response)
  });
}
