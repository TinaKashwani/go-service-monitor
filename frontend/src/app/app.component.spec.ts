import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppComponent } from './app.component';

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let httpTestingController: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();

    httpTestingController = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AppComponent);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('creates the application shell', () => {
    fixture.detectChanges();

    httpTestingController.expectOne('/api/v1/services/status').flush([]);

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the dashboard heading', () => {
    fixture.detectChanges();

    httpTestingController.expectOne('/api/v1/services/status').flush([]);

    const rootElement = fixture.nativeElement as HTMLElement;

    expect(rootElement.textContent).toContain('Live service health at a glance.');
  });
});
