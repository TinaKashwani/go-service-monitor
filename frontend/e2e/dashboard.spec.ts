import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect,test,type Route } from '@playwright/test';
const monitor={id:'11111111-1111-4111-8111-111111111111',name:'Fixture API',url:'https://fixture.example/health',interval_seconds:60,timeout_seconds:5,expected_status:200,enabled:true,created_at:'2026-08-11T12:00:00Z',updated_at:'2026-08-11T12:00:00Z'};
const overview={range:'24h',total_monitors:1,enabled_monitors:1,active_incidents:0,uptime:99.95,average_latency_ms:42,monitors:[{monitor,status:'up',uptime:99.95,average_latency_ms:42,p95_latency_ms:78,check_count:120}]};
const history={...overview.monitors[0],points:[{checked_at:'2026-08-11T12:00:00Z',status:'up',status_code:200,latency_ms:42},{checked_at:'2026-08-11T12:01:00Z',status:'down',status_code:503,latency_ms:80,error_category:'unexpected_status'}]};
test.beforeEach(async({page})=>{await page.route('**/api/v1/**',async route=>mockAPI(route));});
test('overview renders KPIs, chart summary, and range controls',async({page},testInfo)=>{await page.goto('/overview');await expect(page.getByRole('heading',{name:'See what needs attention.'})).toBeVisible();await expect(page.getByLabel('Fleet summary').getByText('99.95%')).toBeVisible();await expect(page.getByRole('button',{name:'7d'})).toBeVisible();await expect(page.getByText(/Fixture API: 42 milliseconds/)).toBeAttached();if(process.env['CAPTURE_SCREENSHOTS']){mkdirSync('../docs/screenshots',{recursive:true});await page.screenshot({path:'../docs/screenshots/overview-'+testInfo.project.name+'.png',fullPage:true})}});
test('monitor management supports search, create form, pause, check, and delete',async({page})=>{page.on('dialog',dialog=>dialog.accept());await page.goto('/monitors');await expect(page.getByText('Fixture API')).toBeVisible();await page.getByPlaceholder('Search name or URL').fill('missing');await expect(page.getByText('No matching monitors')).toBeVisible();await page.getByPlaceholder('Search name or URL').fill('');await page.getByRole('button',{name:/add monitor/i}).click();await page.getByRole('textbox',{name:/^Name/}).fill('New API');await page.getByRole('textbox',{name:'URL'}).fill('https://new.example/health');await page.getByRole('button',{name:'Save monitor'}).click();await expect(page.getByText('Monitor saved.')).toBeVisible();await page.getByRole('button',{name:'Actions for Fixture API'}).click();await page.getByRole('button',{name:'Pause',exact:true}).click();await expect(page.getByText('Monitor paused.')).toBeVisible();await page.getByRole('button',{name:'Check Fixture API now'}).click();await expect(page.getByText('Checked Fixture API.')).toBeVisible();await page.getByRole('button',{name:'Actions for Fixture API'}).click();await page.getByRole('button',{name:'Delete',exact:true}).click();await expect(page.getByText('Monitor deleted.')).toBeVisible()});
test('monitor detail shows history and incident center uses local-time elements',async({page})=>{await page.goto(`/monitors/${monitor.id}`);await expect(page.getByRole('heading',{name:'Fixture API'})).toBeVisible();await expect(page.getByText('P95 latency')).toBeVisible();await expect(page.getByText('unexpected_status')).toBeVisible();await expect(page.locator('time[datetime="2026-08-11T12:00:00Z"]')).toBeVisible();await page.goto('/incidents');await expect(page.getByRole('heading',{name:'Incident center'})).toBeVisible();await expect(page.getByText('No incidents found')).toBeVisible()});
test('main routes have no serious accessibility violations',async({page})=>{for(const path of ['/overview','/monitors','/incidents','/about']){await page.goto(path);await page.waitForLoadState('networkidle');const results=await new AxeBuilder({page}).analyze();expect(results.violations.filter(v=>['critical','serious'].includes(v.impact??'')),path).toEqual([])}});
test('mobile shell has no horizontal overflow',async({page,isMobile})=>{test.skip(!isMobile);await page.goto('/overview');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);await expect(page.getByRole('button',{name:'Toggle navigation'})).toBeVisible()});
test('overview prioritizes unhealthy monitors and preserves stale data after a failed refresh',async({page})=>{
  const unhealthy={...monitor,id:'22222222-2222-4222-8222-222222222222',name:'Checkout',url:'https://checkout.example/health'};
  let overviewRequests=0;
  await page.route('**/api/v1/overview?*',async route=>{
    overviewRequests++;
    if(overviewRequests>1)return route.fulfill({status:503,contentType:'application/json',body:'{"error":{"message":"unavailable"}}'});
    return json(route,{...overview,total_monitors:2,enabled_monitors:2,active_incidents:1,monitors:[overview.monitors[0],{monitor:unhealthy,status:'down',uptime:87.5,average_latency_ms:610,p95_latency_ms:930,check_count:48}]});
  });
  await page.goto('/overview');
  await expect(page.getByRole('heading',{name:'Some websites need attention'})).toBeVisible();
  await expect(page.getByRole('link',{name:/Checkout/}).first()).toBeVisible();
  await page.getByRole('button',{name:'Refresh'}).click();
  await expect(page.getByText('Showing saved data.')).toBeVisible();
  await expect(page.getByText('Checkout',{exact:true}).first()).toBeVisible();
});
test('monitor inventory sorts attention first and reports action failures',async({page})=>{
  const alpha={...monitor,name:'Alpha API'};
  const zulu={...monitor,id:'33333333-3333-4333-8333-333333333333',name:'Zulu Checkout',url:'https://zulu.example/health'};
  await page.route('**/api/v1/**',async route=>{
    const request=route.request();const path=new URL(request.url()).pathname;
    if(path==='/api/v1/monitors'&&request.method()==='GET')return json(route,[alpha,zulu]);
    if(path==='/api/v1/overview')return json(route,{...overview,total_monitors:2,enabled_monitors:2,active_incidents:1,monitors:[overview.monitors[0],{monitor:zulu,status:'down',uptime:80,average_latency_ms:700,p95_latency_ms:900,check_count:30}]});
    if(path.endsWith('/check'))return route.fulfill({status:503,contentType:'application/json',body:'{"error":{"message":"unavailable"}}'});
    return mockAPI(route);
  });
  await page.goto('/monitors');
  const rows=page.locator('.monitor-list article');
  await expect(rows.first()).toContainText('Zulu Checkout');
  await page.getByLabel('Sort monitors',{exact:true}).selectOption('name');
  await expect(rows.first()).toContainText('Alpha API');
  await page.getByRole('button',{name:'Check Zulu Checkout now'}).click();
  await expect(page.getByRole('alert')).toContainText('manual check for Zulu Checkout did not complete');
});
async function mockAPI(route:Route){const request=route.request();const url=new URL(request.url());const path=url.pathname;if(path==='/api/v1/overview')return json(route,overview);if(path==='/api/v1/incidents')return json(route,{items:[],page:1});if(path.endsWith('/history'))return json(route,history);if(path.endsWith('/check'))return json(route,{status:'up'});if(path==='/api/v1/monitors'&&request.method()==='GET')return json(route,[monitor]);if(path==='/api/v1/monitors'&&request.method()==='POST')return json(route,monitor,201);if(path.startsWith('/api/v1/monitors/')&&request.method()==='PATCH')return json(route,{...monitor,enabled:false});if(path.startsWith('/api/v1/monitors/')&&request.method()==='DELETE')return route.fulfill({status:204});if(path.startsWith('/api/v1/monitors/'))return json(route,monitor);return route.fulfill({status:404})}
async function json(route:Route,body:unknown,status=200){await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})}

test('monitor detail handles an empty history without a runtime error', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/history?*', route => json(route, {
    ...history, check_count: 0, uptime: 0, average_latency_ms: 0,
    p95_latency_ms: 0, status: '', points: []
  }));
  await page.goto(`/monitors/${monitor.id}`);
  await expect(page.getByRole('heading', { name: 'No checks in this range' })).toBeVisible();
  expect(errors).toEqual([]);
});
