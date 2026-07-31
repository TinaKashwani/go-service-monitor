# Bruno API collection

Open this `bruno` directory as a collection and select the `Local` environment.

Start the API in its default secure mode:

```powershell
go run ./cmd/server
```

Requests 1–7 can then be run. Request 7 confirms that ad hoc checks are
disabled by default.

To run requests 8–9, stop the server and restart it with ad hoc checks enabled:

```powershell
$env:ENABLE_AD_HOC_CHECKS = "true"
go run ./cmd/server
```

Request 8 performs a real outbound request to `example.com`. Request 9 confirms
that non-HTTP(S) URLs are rejected before any outbound request is attempted.
