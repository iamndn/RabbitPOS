# Agent Standards for RabbitPOS

- **Go Build Standard**: Always use `go build -mod=readonly -o /dev/null ./cmd/server ./internal/...` inside `backend`.
  - Reason 1: `GOMODCACHE` is inside `backend/.gomodcache` (never use recursive `./...` from root backend).
  - Reason 2: `GOFLAGS='-mod=mod'` is set in OS environment (must use `-mod=readonly` to prevent blocking network requests to sum.golang.org).
- **Go Test Standard**: Always use `go test -mod=readonly -v ./internal/handlers -run "<TestName>"`.
- **Frontend Typecheck Standard**: Always use `npx tsc --noEmit` inside `frontend`.
- **Scope Rule**: NEVER build inventory/stock tracking. Only maintain Purchases -> Unit Conversions -> Recipe BOM -> Margin & Cost Calculation.
