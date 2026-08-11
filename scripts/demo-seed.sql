INSERT INTO monitors (name,url,interval_seconds,timeout_seconds,expected_status,keyword,enabled)
VALUES
 ('Example website','https://example.com',300,8,200,'Example Domain',true),
 ('HTTPBin success','https://httpbin.org/get',300,8,200,NULL,true),
 ('HTTPBin slow','https://httpbin.org/delay/2',600,8,200,NULL,true),
 ('GitHub API','https://api.github.com',600,8,200,'current_user_url',true),
 ('Cloudflare trace','https://www.cloudflare.com/cdn-cgi/trace',600,8,200,'fl=',true)
ON CONFLICT DO NOTHING;
