package repository

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/TinaKashwani/go-service-monitor/internal/database"
	"github.com/TinaKashwani/go-service-monitor/internal/model"
)

func TestPostgresRepositoryIntegration(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" { t.Skip("TEST_DATABASE_URL is not set") }
	ctx:=context.Background();pool,err:=database.Open(ctx,databaseURL,10*time.Second);if err!=nil{t.Fatal(err)};defer pool.Close()
	if err:=database.Migrate(ctx,pool);err!=nil{t.Fatal(err)}
	repo:=NewPostgresMonitors(pool);name:=fmt.Sprintf("integration-%d",time.Now().UnixNano())
	created,err:=repo.Create(ctx,model.Monitor{Name:name,URL:"https://example.com/"+name,IntervalSeconds:60,TimeoutSeconds:5,ExpectedStatus:200,Enabled:true});if err!=nil{t.Fatal(err)};t.Cleanup(func(){_ = repo.Delete(ctx,created.ID)})
	if created.ID==""||created.CreatedAt.Location()!=time.UTC{t.Fatalf("expected UUID and UTC timestamp, got %#v",created)}
	created.Enabled=false;updated,err:=repo.Update(ctx,created);if err!=nil||updated.Enabled{t.Fatalf("update failed: %#v %v",updated,err)}
	checks:=NewPostgresChecks(pool);checkedAt:=time.Date(2026,8,11,12,0,0,0,time.FixedZone("test",-3*60*60));stored,err:=checks.Create(ctx,model.StoredCheck{MonitorID:created.ID,Status:"up",StatusCode:200,LatencyMS:12,Source:"manual",CheckedAt:checkedAt});if err!=nil||stored.ID==0||!stored.CheckedAt.Equal(checkedAt.UTC()){t.Fatalf("check persistence failed: %#v %v",stored,err)}
	if _,err:=repo.Create(ctx,model.Monitor{Name:name,URL:"https://unique.example",IntervalSeconds:60,TimeoutSeconds:5,ExpectedStatus:200,Enabled:true});err==nil{t.Fatal("expected unique-name constraint")}
}
