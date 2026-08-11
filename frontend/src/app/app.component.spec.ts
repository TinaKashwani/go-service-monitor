import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { routes } from './app.routes';
describe('AppComponent',()=>{it('renders accessible routed navigation',async()=>{await TestBed.configureTestingModule({imports:[AppComponent],providers:[provideRouter(routes)]}).compileComponents();const fixture=TestBed.createComponent(AppComponent);fixture.detectChanges();const element=fixture.nativeElement as HTMLElement;expect(element.querySelector('nav[aria-label], aside[aria-label]')).not.toBeNull();expect(element.textContent).toContain('Overview');expect(element.querySelector('#main-content')).not.toBeNull()})});
